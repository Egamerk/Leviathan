import type { Entity } from "@rbxts/jecs";
import type { ReactionType } from "shared/data/abilities";
import { DEFAULT_MOVEMENT_STUDS } from "shared/data/combatNav";
import { world } from "shared/ecs/world";

export const MAX_HEALTH = 4;
export const MAX_STAMINA = 4;
export const BASE_INITIATIVE = 5;
export const DEFAULT_MOVEMENT_POINTS = DEFAULT_MOVEMENT_STUDS;

export interface Resource {
	current: number;
	max: number;
}

export type CombatantKind = "player" | "enemy";
export type TurnPhase =
	| "roundStart"
	| "actorTurn"
	| "awaitingAction"
	| "enemyAttack"
	| "resolvingEvade"
	| "complete";

export interface EncounterState {
	id: string;
	userId: number;
	round: number;
	turnIndex: number;
	order: Entity[];
	phase: TurnPhase;
}

export interface RuntimeEvadeWindow {
	encounterId: string;
	windowId: string;
	target: Entity;
	targetUserId: number;
	reaction: ReactionType;
	openAt: number;
	closeAt: number;
	damage: number;
	response?: {
		reaction: ReactionType;
		clientPressTime: number;
		arrivedAt: number;
	};
}

export interface EvadeResolution {
	success: boolean;
	hit: boolean;
}

/** Tag: entity can participate in turn-based combat. */
export const Combatant = world.entity();
export const CombatantType = world.component<CombatantKind>();
export const Health = world.component<Resource>();
export const Stamina = world.component<Resource>();
export const Initiative = world.component<number>();

/** Movement budget in studs. Reset at the start of each actor's turn. */
export const MovementPoints = world.component<number>();
export const MainActionAvailable = world.component<boolean>();
export const SideActionAvailable = world.component<boolean>();

/** Authoritative standing position on walkable ground. */
export const WorldPos = world.component<Vector3>();

/** Encounter state lives on a dedicated ECS entity. */
export const CombatEncounter = world.component<EncounterState>();
export const EvadeWindow = world.component<RuntimeEvadeWindow>();
export const ResolvedEvade = world.component<EvadeResolution>();

export function calculateInitiative(health: Resource): number {
	return BASE_INITIATIVE - (health.max - health.current);
}
