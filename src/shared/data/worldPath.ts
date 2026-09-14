import { PathfindingService } from "@rbxts/services";
import {
	AGENT_HEIGHT,
	AGENT_RADIUS,
	MAX_PATH_WAYPOINTS,
	WAYPOINT_SPACING,
	downsamplePath,
	horizontalDistance,
} from "./combatNav";

function copyPoints(points: readonly Vector3[]): Vector3[] {
	const copy = new Array<Vector3>();
	for (const point of points) copy.push(point);
	return copy;
}

/**
 * Navmesh path via PathfindingService.ComputeAsync — this yields.
 * Never call from a Planck system; run it on a spawned thread.
 */
export function computeWorldPath(from: Vector3, to: Vector3): Vector3[] | undefined {
	if (horizontalDistance(from, to) < 0.2) return undefined;

	const path = PathfindingService.CreatePath({
		AgentRadius: AGENT_RADIUS,
		AgentHeight: AGENT_HEIGHT,
		AgentCanJump: false,
		WaypointSpacing: WAYPOINT_SPACING,
	});
	path.ComputeAsync(from, to);

	if (path.Status !== Enum.PathStatus.Success) {
		path.Destroy();
		if (math.abs(from.Y - to.Y) > 10) return undefined;
		return downsamplePath([from, to], MAX_PATH_WAYPOINTS);
	}

	const waypoints = path.GetWaypoints();
	path.Destroy();

	const points = new Array<Vector3>();
	for (const waypoint of waypoints) {
		if (waypoint.Action === Enum.PathWaypointAction.Jump) continue;
		points.push(waypoint.Position);
	}

	if (points.size() === 0) return undefined;
	if (points.size() === 1) {
		return downsamplePath([from, to], MAX_PATH_WAYPOINTS);
	}

	return downsamplePath(copyPoints(points), MAX_PATH_WAYPOINTS);
}
