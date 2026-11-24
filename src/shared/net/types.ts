import type { ReactionType } from "shared/data/abilities";
import type { CombatantState } from "shared/ecs/types";

export type CombatantSnapshot = CombatantState;

export interface EvadeWindowSchedule {
	windowId: string;
	reaction: ReactionType;
	telegraphAt: number;
	openAt: number;
	closeAt: number;
}

export interface EvadeSchedule {
	encounterId: string;
	abilityId: string;
	windows: EvadeWindowSchedule[];
}

export interface EvadeInput {
	encounterId: string;
	windowId: string;
	reaction: ReactionType;
	clientPressTime: number;
}

export interface EvadeResult {
	encounterId: string;
	windowId: string;
	success: boolean;
	hit: boolean;
}

export type CombatActionType = "attack" | "move" | "endTurn";

export interface CombatAction {
	action: CombatActionType;
	abilityId?: string;
	targetGuid?: string;
	destX?: number;
	destY?: number;
	destZ?: number;
}

export interface WorldPoint {
	x: number;
	y: number;
	z: number;
}

export interface CombatMove {
	encounterId: string;
	guid: string;
	path: WorldPoint[];
}

export type CombatAnimKind = "attack" | "hit";

export interface CombatAnim {
	encounterId: string;
	guid: string;
	anim: CombatAnimKind;
	targetGuid?: string;
}

export type EncounterActor = "player" | "enemy" | "none";

export type EncounterPhase =
	| "roundStart"
	| "actorTurn"
	| "awaitingAction"
	| "enemyAttack"
	| "resolvingEvade"
	| "complete";

export interface EncounterCombatantSnapshot {
	guid: string;
	kind: "player" | "enemy";
	x: number;
	y: number;
	z: number;
	health: { current: number; max: number };
	stamina: { current: number; max: number };
	movementPoints: number;
	mainActionAvailable: boolean;
}

export interface EncounterSnapshot {
	encounterId: string;
	round: number;
	phase: EncounterPhase;
	actor: EncounterActor;
	combatants: EncounterCombatantSnapshot[];
}
