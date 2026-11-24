import { CollectionService, Players, Workspace } from "@rbxts/services";
import { NavConfig } from "shared/config";
import { VoxelGrid } from "shared/nav/grid";
import { findPath, smoothPath } from "shared/nav/pathfinder";
import { createVoxelizer } from "shared/nav/voxelizer";

/**
 * Owns the server's world navigation grid.
 *
 * Baking strategy:
 *  - Parts tagged `NavVolume` (invisible boxes placed by level designers) are
 *    pre-baked at startup, so common combat areas are ready before anyone arrives.
 *  - Anything else is baked lazily, chunk by chunk, the first time a pursuit or an
 *    encounter needs it. Each chunk yields afterwards to keep frame times smooth.
 *  - Call `invalidate` when geometry changes (doors, collapses) to rebake.
 */

export const NAV_VOLUME_TAG = "NavVolume";
export const ENEMY_FOLDER_NAME = "Enemies";

export const worldGrid = new VoxelGrid();
const voxelizer = createVoxelizer(worldGrid);
const baked = new Set<string>();
const baking = new Map<string, thread[]>();

function chunkKey(x: number, z: number) {
	return `${x},${z}`;
}

function refreshExclusions() {
	const excluded = new Array<Instance>();
	for (const player of Players.GetPlayers()) if (player.Character) excluded.push(player.Character);
	const enemies = Workspace.FindFirstChild(ENEMY_FOLDER_NAME);
	if (enemies) excluded.push(enemies);
	voxelizer.setExcluded(excluded);
}

function bakeChunk(cx: number, cz: number) {
	const key = chunkKey(cx, cz);
	if (baked.has(key)) return;

	// Another thread is already baking this chunk: wait for it instead of duplicating work.
	const waiting = baking.get(key);
	if (waiting !== undefined) {
		waiting.push(coroutine.running());
		coroutine.yield();
		return;
	}

	baking.set(key, []);
	refreshExclusions();
	voxelizer.bakeChunk(cx, cz);
	baked.add(key);
	const waiters = baking.get(key)!;
	baking.delete(key);
	for (const thread of waiters) task.spawn(thread);
	task.wait(); // spread big bakes over frames
}

/** Bakes every chunk overlapping the XZ box (yields). */
export function ensureBakedBox(min: Vector3, max: Vector3) {
	const chunkStuds = NavConfig.chunkCells * NavConfig.cellSize;
	const x0 = math.floor(min.X / chunkStuds);
	const x1 = math.floor(max.X / chunkStuds);
	const z0 = math.floor(min.Z / chunkStuds);
	const z1 = math.floor(max.Z / chunkStuds);
	for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) bakeChunk(x, z);
}

export function ensureBaked(center: Vector3, radius: number) {
	const r = new Vector3(radius, 0, radius);
	ensureBakedBox(center.sub(r), center.add(r));
}

export function invalidate(center: Vector3, radius: number) {
	const chunkStuds = NavConfig.chunkCells * NavConfig.cellSize;
	for (let x = math.floor((center.X - radius) / chunkStuds); x <= math.floor((center.X + radius) / chunkStuds); x++) {
		for (
			let z = math.floor((center.Z - radius) / chunkStuds);
			z <= math.floor((center.Z + radius) / chunkStuds);
			z++
		) {
			baked.delete(chunkKey(x, z));
		}
	}
	ensureBaked(center, radius);
}

/**
 * Roaming path between two world positions (yields if chunks need baking).
 * Returns smoothed waypoints, or undefined if nothing walkable was found.
 */
export function findWorldPath(from: Vector3, to: Vector3): Vector3[] | undefined {
	const margin = new Vector3(24, 0, 24);
	const min = new Vector3(math.min(from.X, to.X), 0, math.min(from.Z, to.Z)).sub(margin);
	const max = new Vector3(math.max(from.X, to.X), 0, math.max(from.Z, to.Z)).add(margin);
	ensureBakedBox(min, max);

	const start = worldGrid.nodeAt(from) ?? worldGrid.nearestNode(from, 3, true);
	const goal = worldGrid.nodeAt(to) ?? worldGrid.nearestNode(to, 3, true);
	if (start === undefined || goal === undefined) return undefined;

	const result = findPath(worldGrid, start, goal, { allowPartial: true });
	if (result === undefined) return undefined;
	return smoothPath(worldGrid, result.nodes).map((node) => worldGrid.nodePosition(node));
}

export function startNavService() {
	const prebake = (volume: Instance) => {
		if (!volume.IsA("BasePart")) return;
		const half = volume.Size.div(2);
		task.spawn(() => ensureBakedBox(volume.Position.sub(half), volume.Position.add(half)));
	};
	for (const volume of CollectionService.GetTagged(NAV_VOLUME_TAG)) prebake(volume);
	CollectionService.GetInstanceAddedSignal(NAV_VOLUME_TAG).Connect(prebake);
}
