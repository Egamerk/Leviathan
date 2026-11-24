import { t } from "@rbxts/t";
import type {
	CombatAction,
	CombatAnim,
	CombatantSnapshot,
	CombatMove,
	EncounterSnapshot,
	EvadeInput,
	EvadeResult,
	EvadeSchedule,
} from "./types";

const resourceCheck = t.interface({
	current: t.number,
	max: t.number,
});

const reactionCheck = t.union(t.literal("parry"), t.literal("dodge"));

export const combatantSnapshotCheck: t.check<CombatantSnapshot> = t.interface({
	guid: t.string,
	health: resourceCheck,
	stamina: resourceCheck,
	initiative: t.number,
	movementPoints: t.number,
});

export const encounterSnapshotCheck: t.check<EncounterSnapshot> = t.interface({
	encounterId: t.string,
	round: t.number,
	phase: t.union(
		t.literal("roundStart"),
		t.literal("actorTurn"),
		t.literal("awaitingAction"),
		t.literal("enemyAttack"),
		t.literal("resolvingEvade"),
		t.literal("complete"),
	),
	actor: t.union(t.literal("player"), t.literal("enemy"), t.literal("none")),
	combatants: t.array(
		t.interface({
			guid: t.string,
			kind: t.union(t.literal("player"), t.literal("enemy")),
			x: t.number,
			y: t.number,
			z: t.number,
			health: resourceCheck,
			stamina: resourceCheck,
			movementPoints: t.number,
			mainActionAvailable: t.boolean,
		}),
	),
});

export const evadeScheduleCheck: t.check<EvadeSchedule> = t.interface({
	encounterId: t.string,
	abilityId: t.string,
	windows: t.array(
		t.interface({
			windowId: t.string,
			reaction: reactionCheck,
			telegraphAt: t.number,
			openAt: t.number,
			closeAt: t.number,
		}),
	),
});

export const evadeInputCheck: t.check<EvadeInput> = t.interface({
	encounterId: t.string,
	windowId: t.string,
	reaction: reactionCheck,
	clientPressTime: t.number,
});

export const evadeResultCheck: t.check<EvadeResult> = t.interface({
	encounterId: t.string,
	windowId: t.string,
	success: t.boolean,
	hit: t.boolean,
});

export const combatActionCheck: t.check<CombatAction> = t.interface({
	action: t.union(t.literal("attack"), t.literal("move"), t.literal("endTurn")),
	abilityId: t.optional(t.string),
	targetGuid: t.optional(t.string),
	destX: t.optional(t.number),
	destY: t.optional(t.number),
	destZ: t.optional(t.number),
});

export const combatMoveCheck: t.check<CombatMove> = t.interface({
	encounterId: t.string,
	guid: t.string,
	path: t.array(
		t.interface({
			x: t.number,
			y: t.number,
			z: t.number,
		}),
	),
});

export const combatAnimCheck: t.check<CombatAnim> = t.interface({
	encounterId: t.string,
	guid: t.string,
	anim: t.union(t.literal("attack"), t.literal("hit")),
	targetGuid: t.optional(t.string),
});

export function assertCombatantSnapshot(value: unknown): CombatantSnapshot {
	assert(combatantSnapshotCheck(value), "Invalid CombatantSnapshot at network boundary");
	return value;
}

export function assertEncounterSnapshot(value: unknown): EncounterSnapshot {
	assert(encounterSnapshotCheck(value), "Invalid EncounterSnapshot at network boundary");
	return value;
}

export function assertEvadeSchedule(value: unknown): EvadeSchedule {
	assert(evadeScheduleCheck(value), "Invalid EvadeSchedule at network boundary");
	return value;
}

export function assertEvadeInput(value: unknown): EvadeInput {
	assert(evadeInputCheck(value), "Invalid EvadeInput at network boundary");
	return value;
}

export function assertEvadeResult(value: unknown): EvadeResult {
	assert(evadeResultCheck(value), "Invalid EvadeResult at network boundary");
	return value;
}

export function assertCombatAction(value: unknown): CombatAction {
	assert(combatActionCheck(value), "Invalid CombatAction at network boundary");
	return value;
}

export function assertCombatMove(value: unknown): CombatMove {
	assert(combatMoveCheck(value), "Invalid CombatMove at network boundary");
	return value;
}

export function assertCombatAnim(value: unknown): CombatAnim {
	assert(combatAnimCheck(value), "Invalid CombatAnim at network boundary");
	return value;
}
