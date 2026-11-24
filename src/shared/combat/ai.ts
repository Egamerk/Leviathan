import { type AbilityDef, getAbility } from "shared/data/abilities";
import type { NodeId } from "shared/nav/grid";
import type { CombatEngine } from "./engine";
import type { Combatant, CombatCommand } from "./types";

/**
 * Enemy turn brain. Returns the *next* command for the current AI actor; the
 * server applies it, plays the resulting events, then asks again. This keeps AI
 * on the exact same validation path as players (no special-case cheating).
 *
 * Strategy (intentionally simple, easy to extend per enemy):
 *  1. If any usable ability can hit a diver (including auto-step), use it on the weakest.
 *  2. Else, if Move is free, walk to the reachable tile closest to the nearest diver.
 *  3. Else, end the turn.
 */
export function nextAiCommand(engine: CombatEngine): CombatCommand {
	const actor = engine.currentActor();
	const turn = engine.state.turn;
	const endTurn: CombatCommand = { type: "EndTurn", actorId: actor.id };

	const targets = livingOpponents(engine, actor);
	if (targets.size() === 0) return endTurn;

	if (!turn.mainUsed) {
		const choice = pickAttack(engine, actor, targets);
		if (choice !== undefined) {
			return { type: "UseAbility", actorId: actor.id, abilityId: choice.ability.id, targetId: choice.target.id };
		}
	}

	if (!turn.sideUsed) {
		const destination = approachTile(engine, actor, nearest(engine, actor, targets));
		if (destination !== undefined) return { type: "Move", actorId: actor.id, to: destination };
	}

	return endTurn;
}

function livingOpponents(engine: CombatEngine, actor: Combatant): Combatant[] {
	const out = new Array<Combatant>();
	for (const [, c] of engine.state.combatants) {
		if (c.side !== actor.side && c.condition === "active") out.push(c);
	}
	return out;
}

function nearest(engine: CombatEngine, actor: Combatant, targets: Combatant[]): Combatant {
	let best = targets[0];
	let bestDistance = math.huge;
	for (const target of targets) {
		const d = engine.distance(actor, target);
		if (d < bestDistance) {
			best = target;
			bestDistance = d;
		}
	}
	return best;
}

function pickAttack(engine: CombatEngine, actor: Combatant, targets: Combatant[]) {
	let best: { ability: AbilityDef; target: Combatant } | undefined;
	let bestScore = -math.huge;
	for (const abilityId of actor.abilities) {
		const ability = getAbility(abilityId);
		if (ability === undefined || ability.slot !== "main") continue;
		if ((ability.cost.stamina ?? 0) > actor.stamina.current) continue;
		for (const target of targets) {
			const reach = ability.range + (ability.autoStep ?? 0);
			if (engine.distance(actor, target) > reach) continue;
			// Prefer low-health targets, then stronger abilities.
			const score = -target.health.current / target.health.max + ability.baseDamage * 0.1;
			if (score > bestScore) {
				bestScore = score;
				best = { ability, target };
			}
		}
	}
	return best;
}

function approachTile(engine: CombatEngine, actor: Combatant, target: Combatant): NodeId | undefined {
	const range = engine.movementRange(actor.id);
	if (range === undefined) return undefined;
	const goal = engine.grid.nodePosition(target.node);

	let best: NodeId | undefined;
	let bestDistance = engine.distance(actor, target);
	for (const [node] of range.cost) {
		if (node === actor.node || engine.grid.isBlocked(node)) continue;
		if (engine.isTooCloseToOpponent(actor, node)) continue;
		const d = engine.grid.nodePosition(node).sub(goal).Magnitude;
		if (d < bestDistance) {
			bestDistance = d;
			best = node;
		}
	}
	return best;
}
