import { computed } from "@rbxts/charm";
import { deriveStats } from "shared/modules/stats";
import { playerDataAtom } from "./index";

/**
 * The local player's derived stats, recomputed whenever their synced data
 * changes. `useAtom(localStatsAtom)` in UI; undefined until data arrives.
 */
export const localStatsAtom = computed(() => {
	const data = playerDataAtom();
	return data && deriveStats(data.stats.allocated, data.vessel);
});

/** Unspent stat points (0 until data arrives). */
export const unspentPointsAtom = computed(() => playerDataAtom()?.stats.unspentPoints ?? 0);
