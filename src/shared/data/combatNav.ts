/** Continuous world-space movement for turn-based encounters. */

export const DEFAULT_MOVEMENT_STUDS = 24;
export const MELEE_RANGE_STUDS = 4;
export const AGENT_RADIUS = 2;
export const AGENT_HEIGHT = 5;
export const OCCUPY_RADIUS = 2.5;
export const ENEMY_SPAWN_OFFSET = 14;
export const MAX_PATH_WAYPOINTS = 64;
export const WAYPOINT_SPACING = 4;

export function horizontalDistance(a: Vector3, b: Vector3): number {
	const dx = a.X - b.X;
	const dz = a.Z - b.Z;
	return math.sqrt(dx * dx + dz * dz);
}

export function horizontalOffset(from: Vector3, to: Vector3): Vector3 {
	return new Vector3(to.X - from.X, 0, to.Z - from.Z);
}

export function inMeleeRange(a: Vector3, b: Vector3): boolean {
	return horizontalDistance(a, b) <= MELEE_RANGE_STUDS;
}

export function pathLength(waypoints: readonly Vector3[]): number {
	let total = 0;
	for (let index = 1; index < waypoints.size(); index += 1) {
		const previous = waypoints[index - 1];
		const current = waypoints[index];
		if (previous === undefined || current === undefined) continue;
		total += horizontalDistance(previous, current);
	}
	return total;
}

export function isOccupied(position: Vector3, occupants: readonly Vector3[], radius = OCCUPY_RADIUS): boolean {
	for (const occupant of occupants) {
		if (horizontalDistance(position, occupant) < radius) return true;
	}
	return false;
}

export function pullAwayFromOccupants(
	destination: Vector3,
	occupants: readonly Vector3[],
	radius = OCCUPY_RADIUS,
): Vector3 {
	let result = destination;
	for (const occupant of occupants) {
		if (horizontalDistance(result, occupant) >= radius) continue;
		const away = horizontalOffset(occupant, result);
		const dir = away.Magnitude > 0.1 ? away.Unit : new Vector3(1, 0, 0);
		result = new Vector3(occupant.X + dir.X * radius, result.Y, occupant.Z + dir.Z * radius);
	}
	return result;
}

export function downsamplePath(points: readonly Vector3[], maxPoints: number): Vector3[] {
	const count = points.size();
	if (count === 0) return [];
	if (count <= maxPoints) {
		const copy = new Array<Vector3>();
		for (const point of points) copy.push(point);
		return copy;
	}

	const result = new Array<Vector3>();
	const last = count - 1;
	for (let index = 0; index < maxPoints; index += 1) {
		const sourceIndex = math.floor((index * last) / (maxPoints - 1));
		const point = points[sourceIndex];
		if (point !== undefined) result.push(point);
	}
	return result;
}

export function trimPathToBudget(
	points: readonly Vector3[],
	budget: number,
): { path: Vector3[]; cost: number } {
	const first = points[0];
	if (first === undefined || budget <= 0) {
		return { path: [], cost: 0 };
	}

	const path: Vector3[] = [first];
	let cost = 0;
	for (let index = 1; index < points.size(); index += 1) {
		const previous = path[path.size() - 1];
		const current = points[index];
		if (previous === undefined || current === undefined) continue;

		const step = horizontalDistance(previous, current);
		if (cost + step <= budget + 0.05) {
			cost += step;
			path.push(current);
			continue;
		}

		const remaining = budget - cost;
		if (remaining > 0.05 && step > 0) {
			path.push(previous.Lerp(current, remaining / step));
			cost = budget;
		}
		break;
	}

	return { path, cost };
}

export function toWorldPoint(position: Vector3): { x: number; y: number; z: number } {
	return { x: position.X, y: position.Y, z: position.Z };
}

export function fromWorldPoint(point: { x: number; y: number; z: number }): Vector3 {
	return new Vector3(point.x, point.y, point.z);
}
