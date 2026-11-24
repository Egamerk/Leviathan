import { nextAiCommand } from "shared/combat/ai";
import { CombatEngine } from "shared/combat/engine";
import type { Combatant } from "shared/combat/types";
import { VoxelGrid } from "shared/nav/grid";
import { findPath, reachable, smoothPath } from "shared/nav/pathfinder";
import { captureArena, restoreArena } from "shared/nav/snapshot";
import { applyDefense, resolveParry } from "shared/rules/damage";
import { buildTurnOrder } from "shared/rules/initiative";
import { deriveStats, type MainStats } from "shared/rules/stats";

/**
 * Runs in Studio on server start (see main.server.ts). These checks use a
 * synthetic grid, not raycasts, so they validate the rules/pathfinding in
 * isolation. Promote to a real test runner (e.g. Jest-Roblox via Lune) later.
 */

let failures = 0;
function check(name: string, condition: boolean) {
	if (!condition) {
		failures += 1;
		warn(`[selfTest] FAIL: ${name}`);
	}
}

/** 20×20 flat floor at y=0 with a wall (missing cells) at x=10, z=0..15, and a raised ledge. */
function buildTestGrid(): VoxelGrid {
	const grid = new VoxelGrid({ cellSize: 2, maxStepHeight: 2.25 });
	for (let x = 0; x < 20; x++) {
		for (let z = 0; z < 20; z++) {
			if (x === 10 && z <= 15) continue;
			const floors = [0];
			if (x >= 14 && z >= 14) floors[0] = 6; // plateau too high to step onto
			grid.setColumn(x, z, floors);
		}
	}
	// A bridge over the wall gap: second layer at y=8 in column (10, 5) doesn't connect to y=0.
	grid.setColumn(10, 5, [8]);
	return grid;
}

function testNav() {
	const grid = buildTestGrid();
	const start = grid.nodeAt(new Vector3(1, 0, 1))!;
	const goal = grid.nodeAt(new Vector3(39, 0, 1))!;
	check("nodeAt finds start", start !== undefined);

	const path = findPath(grid, start, goal);
	check("path around wall exists", path !== undefined && path.complete);
	if (path) {
		// Must detour around the wall's end at z=15 → much longer than the straight 38 studs.
		check("path detours around wall", path.cost > 60);
		const smoothed = smoothPath(grid, path.nodes);
		check("smoothing reduces waypoints", smoothed.size() < path.nodes.size());
	}

	const plateau = grid.nodeAt(new Vector3(30, 6, 30))!;
	check("plateau unreachable (step too high)", findPath(grid, start, plateau) === undefined);
	const partial = findPath(grid, start, plateau, { allowPartial: true });
	check("partial path offered", partial !== undefined && !partial.complete);

	const range = reachable(grid, start, 10);
	let maxCost = 0;
	for (const [, cost] of range.cost) maxCost = math.max(maxCost, cost);
	check("reachable respects budget", maxCost <= 10);
	check("reachable non-trivial", range.cost.size() > 10);

	const restored = restoreArena(captureArena(grid, new Vector3(20, 0, 20), 16));
	const a = restored.nodeAt(new Vector3(9, 0, 9));
	const b = restored.nodeAt(new Vector3(29, 0, 9));
	check("snapshot round-trip pathable", a !== undefined && b !== undefined && findPath(restored, a, b) !== undefined);
}

function testRules() {
	check("defense example 1", math.abs(applyDefense(1, 0.25) - 0.75) < 1e-6);
	check("defense example 2 (AP)", math.abs(applyDefense(1, 1, 1) - 1) < 1e-6);
	check("parry full", resolveParry(5, 4, false) === "Parried");
	check("parry shatter", resolveParry(2, 4, false) === "Shattered");
	check("parry stagger", resolveParry(1, 4, false) === "ShatteredStagger");

	const order = buildTurnOrder(
		[
			{ id: "d1", side: "diver", initiative: 5 },
			{ id: "e1", side: "enemy", initiative: 6 },
		],
		"EnemyAmbush",
		"e1",
	);
	check("ambusher first", order.order[0] === "e1");
	check("ambusher extra turn", order.extraTurns.includes("e1"));
}

function makeCombatant(id: string, side: "diver" | "enemy", node: number, stats: MainStats): Combatant {
	const derived = deriveStats(stats);
	return {
		id,
		name: id,
		side,
		control: "ai",
		defId: id,
		stats,
		derived,
		defense: 0,
		canParry: false,
		canDodge: false,
		health: { current: derived.maxHealth, max: derived.maxHealth },
		stamina: { current: 4, max: 4 },
		auxiliary: { current: 2, max: 2 },
		node,
		abilities: ["BasicStrike"],
		statuses: [],
		condition: "active",
		staggered: false,
	};
}

function testEngine() {
	const grid = buildTestGrid();
	const stats: MainStats = { strength: 10, dexterity: 6, endurance: 0, occult: 0, connection: 0 };
	const a = makeCombatant("a", "diver", grid.nodeAt(new Vector3(3, 0, 3))!, stats);
	const b = makeCombatant("b", "enemy", grid.nodeAt(new Vector3(15, 0, 3))!, stats);
	const engine = new CombatEngine("test", "HeadOn", [a, b], grid, new Random(1));
	engine.start();

	// Let both AIs fight; someone must win well before 200 commands.
	let steps = 0;
	while (engine.state.outcome === undefined && steps < 200) {
		const result = engine.apply(nextAiCommand(engine));
		if (!result.ok) engine.apply({ type: "EndTurn", actorId: engine.currentActor().id });
		steps += 1;
	}
	check("AI duel finishes", engine.state.outcome !== undefined);

	const rejected = engine.apply({ type: "EndTurn", actorId: "a" });
	check("no commands after end", !rejected.ok);
}

export function runSelfTests() {
	const [ok, err] = pcall(() => {
		testNav();
		testRules();
		testEngine();
	});
	if (!ok) {
		warn(`[selfTest] crashed: ${err}`);
		return;
	}
	if (failures === 0) print("[selfTest] all nav/rules/engine checks passed");
}
