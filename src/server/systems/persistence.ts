import type { CombatantState } from "shared/ecs/types";
import { gameBus } from "shared/ecs/bus";
import { getSession } from "server/services/profile";
import { readCombatantState } from "server/combat/combatantState";

function writeCombatant(userId: number, state: CombatantState, reason: string): void {
	const session = getSession(userId);
	if (session === undefined || !session.profile.IsActive()) return;

	const saved = session.profile.Data.entities[state.guid];
	if (saved === undefined) return;

	saved.components.health = state.health;
	saved.components.stamina = state.stamina;
	saved.components.initiative = state.initiative;
	saved.components.movementPoints = state.movementPoints;
	print(
		`[persist] save UserId=${userId} (${reason}) HP ${state.health.current}/${state.health.max} initiative ${state.initiative}`,
	);
}

/** Owns all ECS → ProfileStore writes. Gameplay systems never import ProfileStore. */
export function startPersistenceSystem(): void {
	gameBus.subscribe("CombatantChanged", ({ userId, state }) => {
		writeCombatant(userId, state, "CombatantChanged");
	});

	gameBus.subscribe("SaveRequested", ({ userId }) => {
		const session = getSession(userId);
		if (session === undefined) return;

		const state = readCombatantState(session.combatantEntity);
		if (state !== undefined) writeCombatant(userId, state, "SaveRequested");
	});
}
