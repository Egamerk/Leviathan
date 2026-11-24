import { NavConfig } from "shared/config";
import type { NodeId, VoxelGrid } from "./grid";
import { MinHeap } from "./heap";

export interface PathOptions {
	/** Stop expanding past this accumulated cost (studs). Used for combat move budgets. */
	maxCost?: number;
	maxExpansions?: number;
	/**
	 * If the goal can't be reached, return the path to the explored node closest to
	 * it instead of failing. Pursuers and "move toward" AI want this.
	 */
	allowPartial?: boolean;
}

export interface PathResult {
	nodes: NodeId[];
	cost: number;
	/** False when `allowPartial` returned a path that stops short of the goal. */
	complete: boolean;
}

const heap = new MinHeap();
const neighborNodes = new Array<NodeId>();
const neighborCosts = new Array<number>();

function reconstruct(parent: Map<NodeId, NodeId>, last: NodeId): NodeId[] {
	const path = [last];
	let current = last;
	let previous = parent.get(current);
	while (previous !== undefined) {
		path.push(previous);
		current = previous;
		previous = parent.get(current);
	}
	// Reverse in place (roblox-ts arrays have no .reverse()).
	const n = path.size();
	for (let i = 0; i < n / 2 - 0.5; i++) {
		const tmp = path[i];
		path[i] = path[n - 1 - i];
		path[n - 1 - i] = tmp;
	}
	return path;
}

/** A* over a voxel grid. The goal node may be blocked (e.g. path *to* an enemy). */
export function findPath(
	grid: VoxelGrid,
	start: NodeId,
	goal: NodeId,
	options: PathOptions = {},
): PathResult | undefined {
	const maxCost = options.maxCost ?? math.huge;
	const maxExpansions = options.maxExpansions ?? NavConfig.maxExpansions;

	const gScore = new Map<NodeId, number>([[start, 0]]);
	const parent = new Map<NodeId, NodeId>();
	const closed = new Set<NodeId>();

	heap.clear();
	heap.push(start, grid.heuristic(start, goal));

	let bestNode = start;
	let bestHeuristic = grid.heuristic(start, goal);
	let expansions = 0;

	while (heap.size() > 0 && expansions < maxExpansions) {
		const current = heap.pop();
		if (closed.has(current)) continue; // stale heap entry
		if (current === goal) {
			return { nodes: reconstruct(parent, current), cost: gScore.get(current)!, complete: true };
		}
		closed.add(current);
		expansions += 1;

		const currentG = gScore.get(current)!;
		const count = grid.neighbors(current, neighborNodes, neighborCosts);
		for (let i = 0; i < count; i++) {
			const neighbor = neighborNodes[i];
			if (closed.has(neighbor)) continue;
			const tentative = currentG + neighborCosts[i];
			if (tentative > maxCost) continue;
			const known = gScore.get(neighbor);
			if (known !== undefined && known <= tentative) continue;

			gScore.set(neighbor, tentative);
			parent.set(neighbor, current);
			const h = grid.heuristic(neighbor, goal);
			heap.push(neighbor, tentative + h);
			if (h < bestHeuristic) {
				bestHeuristic = h;
				bestNode = neighbor;
			}
		}

		// The goal itself may be blocked (an occupied tile); accept arriving adjacent to it.
		if (grid.isBlocked(goal) && grid.heuristic(current, goal) <= grid.cellSize * math.sqrt(2) + 1e-3) {
			return { nodes: reconstruct(parent, current), cost: currentG, complete: true };
		}
	}

	if (options.allowPartial && bestNode !== start) {
		return { nodes: reconstruct(parent, bestNode), cost: gScore.get(bestNode)!, complete: false };
	}
	return undefined;
}

export interface ReachableSet {
	/** node → cheapest cost from the origin (studs). */
	cost: Map<NodeId, number>;
	parent: Map<NodeId, NodeId>;
}

/**
 * Dijkstra flood fill from `start` up to `budget` studs. Gives the combat
 * "movement range" overlay and lets the server validate a move in O(1).
 */
export function reachable(grid: VoxelGrid, start: NodeId, budget: number): ReachableSet {
	const cost = new Map<NodeId, number>([[start, 0]]);
	const parent = new Map<NodeId, NodeId>();
	const closed = new Set<NodeId>();

	heap.clear();
	heap.push(start, 0);

	while (heap.size() > 0) {
		const current = heap.pop();
		if (closed.has(current)) continue;
		closed.add(current);
		const currentCost = cost.get(current)!;

		const count = grid.neighbors(current, neighborNodes, neighborCosts);
		for (let i = 0; i < count; i++) {
			const neighbor = neighborNodes[i];
			const tentative = currentCost + neighborCosts[i];
			if (tentative > budget) continue;
			const known = cost.get(neighbor);
			if (known !== undefined && known <= tentative) continue;
			cost.set(neighbor, tentative);
			parent.set(neighbor, current);
			heap.push(neighbor, tentative);
		}
	}
	return { cost, parent };
}

export function pathFromReachable(set: ReachableSet, target: NodeId): NodeId[] | undefined {
	if (!set.cost.has(target)) return undefined;
	return reconstruct(set.parent, target);
}

/**
 * Greedy string-pulling: drop intermediate nodes while a straight walkable line
 * exists. Produces natural-looking routes for roaming enemies.
 */
export function smoothPath(grid: VoxelGrid, nodes: readonly NodeId[]): NodeId[] {
	if (nodes.size() <= 2) return [...nodes];
	const result = [nodes[0]];
	let anchor = 0;
	for (let i = 2; i < nodes.size(); i++) {
		if (!grid.walkableLine(nodes[anchor], nodes[i])) {
			result.push(nodes[i - 1]);
			anchor = i - 1;
		}
	}
	result.push(nodes[nodes.size() - 1]);
	return result;
}

/** Trims a path so its cost fits a budget (used when an AI can't reach its target this turn). */
export function trimToBudget(grid: VoxelGrid, nodes: readonly NodeId[], budget: number): NodeId[] {
	const out = new Array<NodeId>();
	if (nodes.size() === 0) return out;
	out.push(nodes[0]);
	let spent = 0;
	for (let i = 1; i < nodes.size(); i++) {
		const step = grid.nodePosition(nodes[i]).sub(grid.nodePosition(nodes[i - 1])).Magnitude;
		if (spent + step > budget + 1e-3) break;
		spent += step;
		out.push(nodes[i]);
	}
	return out;
}
