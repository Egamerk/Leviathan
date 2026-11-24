import { CollectionService, Workspace } from "@rbxts/services";
import { NavConfig } from "shared/config";
import type { VoxelGrid } from "./grid";

/**
 * Bakes world geometry into a `VoxelGrid` with downward raycasts.
 *
 * For every cell centre we cast a ray straight down from the ceiling. Each hit
 * that is flat enough becomes a candidate floor; we then test the space above it
 * with an overlap box (agent height × agent diameter). A box that overlaps
 * anything means a wall, low ceiling or prop is in the way, which also erodes
 * cells next to walls by `agentRadius`. The ray then continues below the hit to
 * find floors underneath (bridges, caves, multi-storey ruins).
 *
 * Level-design hooks (CollectionService tags):
 *  - `NavIgnore`  : parts the voxelizer pretends don't exist (foliage, VFX)
 *  - `NavBlocker` : invisible walls; never walkable and always obstruct
 */

export const NAV_IGNORE_TAG = "NavIgnore";
export const NAV_BLOCKER_TAG = "NavBlocker";

export interface BakeBounds {
	minY: number;
	maxY: number;
}

export interface Voxelizer {
	/** Bakes one column. Returns the floors found (also written to the grid). */
	bakeColumn: (x: number, z: number) => number[];
	/** Bakes a square chunk of `chunkCells × chunkCells` columns. */
	bakeChunk: (chunkX: number, chunkZ: number) => void;
	/** Replaces the exclude list (characters, enemy models…) between bakes. */
	setExcluded: (instances: Instance[]) => void;
}

export function createVoxelizer(grid: VoxelGrid, bounds?: BakeBounds): Voxelizer {
	const cellSize = grid.cellSize;
	const minNormalY = math.cos(math.rad(NavConfig.maxSlopeDegrees));
	const maxY = bounds?.maxY ?? NavConfig.defaultCeiling;
	const minY = bounds?.minY ?? NavConfig.defaultFloor;

	const clearanceHeight = NavConfig.agentHeight - NavConfig.maxStepHeight;
	const clearanceWidth = math.max(cellSize * 0.9, NavConfig.agentRadius * 2);
	const clearanceSize = new Vector3(clearanceWidth, clearanceHeight, clearanceWidth);

	const rayParams = new RaycastParams();
	rayParams.FilterType = Enum.RaycastFilterType.Exclude;
	rayParams.IgnoreWater = true;
	rayParams.RespectCanCollide = true;

	const overlapParams = new OverlapParams();
	overlapParams.FilterType = Enum.RaycastFilterType.Exclude;
	overlapParams.RespectCanCollide = true;

	let excluded = new Array<Instance>();
	const refreshFilters = () => {
		const list = [...excluded, ...CollectionService.GetTagged(NAV_IGNORE_TAG)];
		rayParams.FilterDescendantsInstances = list;
		overlapParams.FilterDescendantsInstances = list;
	};
	refreshFilters();

	const bakeColumn = (x: number, z: number): number[] => {
		const cx = (x + 0.5) * cellSize;
		const cz = (z + 0.5) * cellSize;
		const floors = new Array<number>();

		let originY = maxY;
		// Each iteration finds one surface; bound the loop in case of degenerate geometry.
		for (let guard = 0; guard < NavConfig.maxLayers * 4 && originY > minY; guard++) {
			const hit = Workspace.Raycast(new Vector3(cx, originY, cz), new Vector3(0, minY - originY, 0), rayParams);
			if (hit === undefined) break;

			const y = hit.Position.Y;
			const isBlocker = CollectionService.HasTag(hit.Instance, NAV_BLOCKER_TAG);
			if (!isBlocker && hit.Normal.Y >= minNormalY) {
				const boxCenter = new CFrame(cx, y + NavConfig.maxStepHeight + clearanceHeight / 2, cz);
				const obstructions = Workspace.GetPartBoundsInBox(boxCenter, clearanceSize, overlapParams);
				if (obstructions.size() === 0) floors.push(y);
			}

			// A floor closer than agentHeight under this surface could never be stood on,
			// so skip that span. Rays that start inside a part pass out of it without a hit.
			originY = y - math.max(NavConfig.agentHeight, 0.1);
		}

		grid.setColumn(x, z, floors);
		return floors;
	};

	return {
		bakeColumn,
		bakeChunk: (chunkX, chunkZ) => {
			const size = NavConfig.chunkCells;
			for (let x = chunkX * size; x < (chunkX + 1) * size; x++) {
				for (let z = chunkZ * size; z < (chunkZ + 1) * size; z++) {
					bakeColumn(x, z);
				}
			}
		},
		setExcluded: (instances) => {
			excluded = instances;
			refreshFilters();
		},
	};
}
