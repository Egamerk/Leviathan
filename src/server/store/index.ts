import { atom } from "@rbxts/charm";
import type { PlayerData } from "shared/schemas/player-data";

/**
 * Server-authoritative state (Charm atoms). Services own the writes; anything
 * clients need is exposed through `StateSyncService`.
 *
 * Atoms hold immutable snapshots: replace values, don't mutate them, or
 * subscribers (and replication) won't see the change.
 */

/** userId → that player's persisted data (mirrors their ProfileStore profile). */
export const playerDataAtom = atom<ReadonlyMap<number, PlayerData>>(new Map());
