import { VoxelGrid } from "./grid";

/**
 * Packs a rectangular region of a grid into a `buffer` so the server can send a
 * combat arena to clients once. Clients rebuild an identical `VoxelGrid` and run
 * the same Dijkstra locally for the move-range overlay; the server re-validates.
 *
 * Layout per column (row-major, x outer): u8 floorCount, then floorCount × f32.
 */
export interface ArenaSnapshot {
	originX: number;
	originZ: number;
	width: number;
	depth: number;
	cellSize: number;
	maxStepHeight: number;
	columns: buffer;
}

export function captureArena(grid: VoxelGrid, center: Vector3, radiusStuds: number): ArenaSnapshot {
	const [cx, cz] = grid.worldToCell(center);
	const radiusCells = math.ceil(radiusStuds / grid.cellSize);
	const originX = cx - radiusCells;
	const originZ = cz - radiusCells;
	const width = radiusCells * 2 + 1;
	const depth = width;

	// Measure first so the buffer is exactly sized.
	let bytes = 0;
	for (let x = 0; x < width; x++) {
		for (let z = 0; z < depth; z++) {
			bytes += 1 + (grid.getColumn(originX + x, originZ + z)?.size() ?? 0) * 4;
		}
	}

	const columns = buffer.create(bytes);
	let offset = 0;
	for (let x = 0; x < width; x++) {
		for (let z = 0; z < depth; z++) {
			const floors = grid.getColumn(originX + x, originZ + z);
			const count = floors?.size() ?? 0;
			buffer.writeu8(columns, offset, count);
			offset += 1;
			for (let i = 0; i < count; i++) {
				buffer.writef32(columns, offset, floors![i]);
				offset += 4;
			}
		}
	}

	return { originX, originZ, width, depth, cellSize: grid.cellSize, maxStepHeight: grid.maxStepHeight, columns };
}

export function restoreArena(snapshot: ArenaSnapshot): VoxelGrid {
	const grid = new VoxelGrid({ cellSize: snapshot.cellSize, maxStepHeight: snapshot.maxStepHeight });
	let offset = 0;
	for (let x = 0; x < snapshot.width; x++) {
		for (let z = 0; z < snapshot.depth; z++) {
			const count = buffer.readu8(snapshot.columns, offset);
			offset += 1;
			const floors = new Array<number>();
			for (let i = 0; i < count; i++) {
				floors.push(buffer.readf32(snapshot.columns, offset));
				offset += 4;
			}
			if (count > 0) grid.setColumn(snapshot.originX + x, snapshot.originZ + z, floors);
		}
	}
	return grid;
}
