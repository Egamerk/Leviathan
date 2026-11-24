import { atom } from "@rbxts/charm";
import type { PlayerData } from "shared/schemas/player-data";
import type { Vitals } from "shared/schemas/vitals";

/**
 * Server-authoritative state (Charm atoms). Services own the writes; anything
 * clients need is exposed through `StateSyncService`.
 *
 * Atoms hold immutable snapshots: replace values, don't mutate them, or
 * subscribers (and replication) won't see the change.
 */

/** userId → that player's persisted data (mirrors their ProfileStore profile). */
export const playerDataAtom = atom<ReadonlyMap<number, PlayerData>>(new Map());

/** userId → current resource pools (owned by VitalsService). */
export const vitalsAtom = atom<ReadonlyMap<number, Vitals>>(new Map());

/** Immutable map update helper: returns a copy with `key` set (or removed when `value` is undefined). */
export function withEntry<K, V>(map: ReadonlyMap<K, V>, key: K, value: V | undefined): ReadonlyMap<K, V> {
	const copy = new Map<K, V>();
	for (const [k, v] of map) if (k !== key) copy.set(k, v);
	if (value !== undefined) copy.set(key, value);
	return copy;
}
