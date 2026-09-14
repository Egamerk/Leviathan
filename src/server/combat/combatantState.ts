import type { Entity } from "@rbxts/jecs";
import {
	Guid,
	Health,
	Initiative,
	MovementPoints,
	OwnerUserId,
	Stamina,
} from "shared/ecs/components";
import type { CombatantState } from "shared/ecs/types";
import { gameBus } from "shared/ecs/bus";
import { world } from "shared/ecs/world";

export function readCombatantState(entity: Entity): CombatantState | undefined {
	const guid = world.get(entity, Guid);
	const health = world.get(entity, Health);
	const stamina = world.get(entity, Stamina);
	const initiative = world.get(entity, Initiative);
	const movementPoints = world.get(entity, MovementPoints);
	if (
		guid === undefined ||
		health === undefined ||
		stamina === undefined ||
		initiative === undefined ||
		movementPoints === undefined
	) {
		return undefined;
	}

	return { guid, health, stamina, initiative, movementPoints };
}

export function publishCombatantState(entity: Entity): void {
	const userId = world.get(entity, OwnerUserId);
	const state = readCombatantState(entity);
	if (userId === undefined || state === undefined) return;

	gameBus.publish("CombatantChanged", { userId, state });
}
