import { Name } from "@rbxts/jecs";
import { world } from "shared/ecs/world";

export { Name };

/** Tag: entity represents a live Roblox player session. */
export const Player = world.entity();

/** Roblox UserId for a player entity. */
export const UserId = world.component<number>();

/**
 * Stable persistence identifier. Generated once at spawn and stored in the
 * player's profile. Never persist raw jecs entity ids — they are recycled.
 */
export const Guid = world.component<string>();

/** Tag: entity's state should be written to ProfileStore. */
export const Persistent = world.entity();

/** Owner of an entity (the player's UserId) for replication routing. */
export const OwnerUserId = world.component<number>();
