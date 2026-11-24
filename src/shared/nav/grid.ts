import { NavConfig } from "shared/config";

/**
 * A "2.5D voxel" navigation grid.
 *
 * The world is divided into square columns (`cellSize` studs wide). Each column
 * stores up to `maxLayers` walkable floor heights, sorted bottom → top, so a
 * bridge over a canyon or a cave under a cliff are both representable. A node is
 * one (column, layer) pair, packed into a single number for cheap hashing.
 *
 * The same class is used for:
 *  - the server's world grid (baked lazily, chunk by chunk, by `voxelizer.ts`)
 *  - a combat arena (a rectangular copy sent to clients via `snapshot.ts`)
 */

export type NodeId = number;

const OFFSET = 32768;
const SPAN = 65536;
const LAYERS = NavConfig.maxLayers;

export function columnKey(x: number, z: number): number {
	return (x + OFFSET) * SPAN + (z + OFFSET);
}

export function packNode(x: number, z: number, layer: number): NodeId {
	return columnKey(x, z) * LAYERS + layer;
}

export function unpackNode(node: NodeId): LuaTuple<[x: number, z: number, layer: number]> {
	const layer = node % LAYERS;
	const column = (node - layer) / LAYERS;
	const z = (column % SPAN) - OFFSET;
	const x = (column - (column % SPAN)) / SPAN - OFFSET;
	return $tuple(x, z, layer);
}

/** 8-connected neighbourhood. Orthogonals first so diagonals can check corner cutting. */
const DIRECTIONS: ReadonlyArray<[number, number]> = [
	[1, 0],
	[-1, 0],
	[0, 1],
	[0, -1],
	[1, 1],
	[1, -1],
	[-1, 1],
	[-1, -1],
];

export interface GridSettings {
	cellSize: number;
	maxStepHeight: number;
}

export class VoxelGrid {
	public readonly cellSize: number;
	public readonly maxStepHeight: number;

	/** columnKey → ascending floor heights (world Y of the walkable surface). */
	private readonly columns = new Map<number, number[]>();
	/** Nodes temporarily impassable (combatants standing on them, hazards…). */
	private readonly blocked = new Set<NodeId>();

	public constructor(settings: GridSettings = NavConfig) {
		this.cellSize = settings.cellSize;
		this.maxStepHeight = settings.maxStepHeight;
	}

	// ── Coordinates ─────────────────────────────────────────────────────────

	public worldToCell(position: Vector3): LuaTuple<[x: number, z: number]> {
		return $tuple(math.floor(position.X / this.cellSize), math.floor(position.Z / this.cellSize));
	}

	/** World-space centre of a cell, at its floor height. */
	public nodePosition(node: NodeId): Vector3 {
		const [x, z, layer] = unpackNode(node);
		const floors = this.columns.get(columnKey(x, z));
		const y = floors?.[layer] ?? 0;
		return new Vector3((x + 0.5) * this.cellSize, y, (z + 0.5) * this.cellSize);
	}

	// ── Storage ─────────────────────────────────────────────────────────────

	public setColumn(x: number, z: number, floors: number[]): void {
		const key = columnKey(x, z);
		if (floors.size() === 0) {
			this.columns.delete(key);
			return;
		}
		floors.sort((a, b) => a < b);
		while (floors.size() > LAYERS) floors.shift(); // keep the top-most floors
		this.columns.set(key, floors);
	}

	public getColumn(x: number, z: number): readonly number[] | undefined {
		return this.columns.get(columnKey(x, z));
	}

	public forEachColumn(callback: (x: number, z: number, floors: readonly number[]) => void): void {
		for (const [key, floors] of this.columns) {
			const z = (key % SPAN) - OFFSET;
			const x = (key - (key % SPAN)) / SPAN - OFFSET;
			callback(x, z, floors);
		}
	}

	public hasNode(node: NodeId): boolean {
		const [x, z, layer] = unpackNode(node);
		const floors = this.columns.get(columnKey(x, z));
		return floors !== undefined && layer < floors.size();
	}

	// ── Queries ─────────────────────────────────────────────────────────────

	/**
	 * The node a world position is standing on: the highest floor in that column
	 * that is at or slightly below `position.Y`.
	 */
	public nodeAt(position: Vector3, tolerance = 4): NodeId | undefined {
		const [x, z] = this.worldToCell(position);
		const floors = this.columns.get(columnKey(x, z));
		if (floors === undefined) return undefined;

		let best: number | undefined;
		for (let layer = 0; layer < floors.size(); layer++) {
			if (floors[layer] <= position.Y + tolerance) best = layer;
		}
		if (best === undefined) return undefined;
		return packNode(x, z, best);
	}

	/**
	 * Breadth-first spiral search for the closest existing, unblocked node.
	 * Used to snap characters onto the grid when an encounter starts.
	 */
	public nearestNode(position: Vector3, maxRadiusCells = 6, allowBlocked = false): NodeId | undefined {
		const [cx, cz] = this.worldToCell(position);
		let best: NodeId | undefined;
		let bestDistance = math.huge;

		for (let radius = 0; radius <= maxRadiusCells; radius++) {
			for (let dx = -radius; dx <= radius; dx++) {
				for (let dz = -radius; dz <= radius; dz++) {
					if (math.max(math.abs(dx), math.abs(dz)) !== radius) continue;
					const floors = this.columns.get(columnKey(cx + dx, cz + dz));
					if (floors === undefined) continue;
					for (let layer = 0; layer < floors.size(); layer++) {
						const node = packNode(cx + dx, cz + dz, layer);
						if (!allowBlocked && this.blocked.has(node)) continue;
						const distance = this.nodePosition(node).sub(position).Magnitude;
						if (distance < bestDistance) {
							bestDistance = distance;
							best = node;
						}
					}
				}
			}
			// Anything found in ring r beats anything in ring r+2; one extra ring settles ties.
			if (best !== undefined && radius >= 1) break;
		}
		return best;
	}

	/** Layer in column (x, z) reachable from `fromY` without exceeding the step height. */
	private stepLayer(x: number, z: number, fromY: number): number | undefined {
		const floors = this.columns.get(columnKey(x, z));
		if (floors === undefined) return undefined;
		let best: number | undefined;
		let bestDelta = math.huge;
		for (let layer = 0; layer < floors.size(); layer++) {
			const delta = math.abs(floors[layer] - fromY);
			if (delta <= this.maxStepHeight && delta < bestDelta) {
				best = layer;
				bestDelta = delta;
			}
		}
		return best;
	}

	/**
	 * Fills `outNodes`/`outCosts` with walkable neighbours and returns how many.
	 * Costs are 3D stud distances so combat movement budgets read naturally.
	 */
	public neighbors(node: NodeId, outNodes: NodeId[], outCosts: number[]): number {
		const [x, z, layer] = unpackNode(node);
		const floors = this.columns.get(columnKey(x, z));
		if (floors === undefined) return 0;
		const y = floors[layer];

		let count = 0;
		const orthogonalOk = [false, false, false, false];

		for (let i = 0; i < DIRECTIONS.size(); i++) {
			const [dx, dz] = DIRECTIONS[i];
			const isDiagonal = dx !== 0 && dz !== 0;
			if (isDiagonal) {
				// No corner cutting: both orthogonal neighbours must be walkable.
				const xOk = orthogonalOk[dx === 1 ? 0 : 1];
				const zOk = orthogonalOk[dz === 1 ? 2 : 3];
				if (!xOk || !zOk) continue;
			}

			const nx = x + dx;
			const nz = z + dz;
			const nextLayer = this.stepLayer(nx, nz, y);
			if (nextLayer === undefined) continue;
			const neighbor = packNode(nx, nz, nextLayer);
			if (i < 4) orthogonalOk[i] = true;
			if (this.blocked.has(neighbor)) continue;

			const ny = this.columns.get(columnKey(nx, nz))![nextLayer];
			const horizontal = (isDiagonal ? math.sqrt(2) : 1) * this.cellSize;
			const vertical = ny - y;
			outNodes[count] = neighbor;
			outCosts[count] = math.sqrt(horizontal * horizontal + vertical * vertical);
			count += 1;
		}
		return count;
	}

	/** Admissible octile-distance heuristic in studs. */
	public heuristic(a: NodeId, b: NodeId): number {
		const [ax, az] = unpackNode(a);
		const [bx, bz] = unpackNode(b);
		const dx = math.abs(ax - bx);
		const dz = math.abs(az - bz);
		return (math.max(dx, dz) + (math.sqrt(2) - 1) * math.min(dx, dz)) * this.cellSize;
	}

	/**
	 * True when an agent can walk the straight line a → b over the grid without
	 * leaving walkable floor or exceeding the step height. Used for path smoothing.
	 */
	public walkableLine(a: NodeId, b: NodeId): boolean {
		const from = this.nodePosition(a);
		const to = this.nodePosition(b);
		const flat = new Vector3(to.X - from.X, 0, to.Z - from.Z);
		const distance = flat.Magnitude;
		if (distance < 1e-3) return true;

		const steps = math.ceil(distance / (this.cellSize * 0.5));
		let y = from.Y;
		for (let i = 1; i <= steps; i++) {
			const point = from.add(flat.mul(i / steps));
			const cx = math.floor(point.X / this.cellSize);
			const cz = math.floor(point.Z / this.cellSize);
			const layer = this.stepLayer(cx, cz, y);
			if (layer === undefined) return false;
			const node = packNode(cx, cz, layer);
			if (this.blocked.has(node) && node !== b) return false;
			y = this.columns.get(columnKey(cx, cz))![layer];
		}
		return true;
	}

	// ── Dynamic blocking ────────────────────────────────────────────────────

	public block(node: NodeId): void {
		this.blocked.add(node);
	}

	public unblock(node: NodeId): void {
		this.blocked.delete(node);
	}

	public isBlocked(node: NodeId): boolean {
		return this.blocked.has(node);
	}

	public clearBlocked(): void {
		this.blocked.clear();
	}
}
