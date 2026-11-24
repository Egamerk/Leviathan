import { CombatConfig } from "shared/config";

/**
 * Trello: Combat → Initiative, Out of Combat → Initiative/Encounter.
 *
 * Base 5, reduced proportionally by missing health, +0.05 per Dexterity.
 */
export function baseInitiative(currentHealth: number, maxHealth: number, dexterity: number): number {
	const healthFraction = maxHealth > 0 ? math.clamp(currentHealth / maxHealth, 0, 1) : 0;
	const value = CombatConfig.baseInitiative * healthFraction + dexterity * CombatConfig.initiativePerDexterity;
	return math.max(value, CombatConfig.minInitiative);
}

/** How the fight started. Decided by the detection system when an encounter triggers. */
export type EncounterKind =
	/** Enemy saw you while you were facing / aware of it. Straight initiative comparison. */
	| "HeadOn"
	/** A diver engaged an unaware enemy: +25% diver initiative and the initiator acts first. */
	| "DiverStealth"
	/** Enemy caught you from behind or in the dark: −50% diver initiative, ambusher acts twice. */
	| "EnemyAmbush";

export interface InitiativeEntry {
	id: string;
	side: "diver" | "enemy";
	initiative: number;
}

export interface TurnOrderResult {
	order: string[];
	/** Combatants that receive an extra consecutive turn in round 1. */
	extraTurns: string[];
}

/**
 * Builds the round-1 turn order. Ties are broken by side (divers first) then id
 * so the result is deterministic on server and client.
 */
export function buildTurnOrder(entries: InitiativeEntry[], kind: EncounterKind, initiatorId?: string): TurnOrderResult {
	const adjusted = entries.map((entry) => {
		let initiative = entry.initiative;
		if (entry.side === "diver" && kind === "DiverStealth")
			initiative *= 1 + CombatConfig.diverStealthInitiativeBonus;
		if (entry.side === "diver" && kind === "EnemyAmbush")
			initiative *= 1 - CombatConfig.enemyAmbushInitiativePenalty;
		return { ...entry, initiative };
	});

	adjusted.sort((a, b) => {
		if (a.initiative !== b.initiative) return a.initiative > b.initiative;
		if (a.side !== b.side) return a.side === "diver";
		return a.id < b.id;
	});

	const order = adjusted.map((entry) => entry.id);
	const extraTurns = new Array<string>();

	if (initiatorId !== undefined && (kind === "DiverStealth" || kind === "EnemyAmbush")) {
		const index = order.indexOf(initiatorId);
		if (index > 0) {
			order.remove(index);
			order.unshift(initiatorId);
		}
		if (kind === "EnemyAmbush") extraTurns.push(initiatorId);
	}

	return { order, extraTurns };
}
