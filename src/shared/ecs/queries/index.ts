import type { Entity, World } from "@rbxts/jecs";
import { Guid, OwnerUserId, Persistent, Player, UserId } from "shared/ecs/components";

/** Iterate live player entities: [entity, userId]. */
export function playerEntities(world: World) {
	return world.query(UserId).with(Player);
}

/** Iterate entities that must be written to ProfileStore: [entity, guid, ownerUserId]. */
export function persistentEntities(world: World) {
	return world.query(Guid, OwnerUserId).with(Persistent);
}

/** Find the player entity for a given UserId, or undefined. */
export function findPlayerEntity(world: World, userId: number): Entity | undefined {
	for (const [entity, id] of playerEntities(world)) {
		if (id === userId) return entity;
	}
	return undefined;
}
