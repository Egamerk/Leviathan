import { computed } from "@rbxts/charm";
import { deriveStats } from "shared/modules/stats";
import { playerDataAtom, vitalsAtom } from "./index";

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

function fraction(current: number | undefined, max: number | undefined): number {
	if (current === undefined || max === undefined || max <= 0) return 0;
	return math.clamp(current / max, 0, 1);
}

/** 0..1 fill of each HUD pool. Full until synced data arrives, so the HUD doesn't flash empty on join. */
export const healthFractionAtom = computed(() =>
	vitalsAtom() ? fraction(vitalsAtom()!.health, localStatsAtom()?.maxHealth) : 1,
);
export const staminaFractionAtom = computed(() =>
	vitalsAtom() ? fraction(vitalsAtom()!.stamina, localStatsAtom()?.maxStamina) : 1,
);
export const auxiliaryFractionAtom = computed(() =>
	vitalsAtom() ? fraction(vitalsAtom()!.auxiliary, localStatsAtom()?.maxAuxiliary) : 1,
);
export const reservoirFractionAtom = computed(() =>
	vitalsAtom() ? fraction(vitalsAtom()!.reservoir, localStatsAtom()?.maxReservoir) : 0,
);
