import type { DerivedStats } from "shared/modules/stats";

/**
 * Current values of a player's resource pools. Maximums come from
 * DerivedStats; these are the "how much is left" half. Session state, not
 * persisted (yet): health carrying over between expeditions is a later decision.
 */
export interface Vitals {
	health: number;
	stamina: number;
	auxiliary: number;
	reservoir: number;
}

export type VitalName = keyof Vitals;

export const VITAL_MAX_KEY = {
	health: "maxHealth",
	stamina: "maxStamina",
	auxiliary: "maxAuxiliary",
	reservoir: "maxReservoir",
} as const satisfies Record<VitalName, keyof DerivedStats>;

export function fullVitals(stats: DerivedStats): Vitals {
	return {
		health: stats.maxHealth,
		stamina: stats.maxStamina,
		auxiliary: stats.maxAuxiliary,
		reservoir: stats.maxReservoir,
	};
}

/** Clamp every pool into [0, max]. */
export function clampVitals(vitals: Vitals, stats: DerivedStats): Vitals {
	return {
		health: math.clamp(vitals.health, 0, stats.maxHealth),
		stamina: math.clamp(vitals.stamina, 0, stats.maxStamina),
		auxiliary: math.clamp(vitals.auxiliary, 0, stats.maxAuxiliary),
		reservoir: math.clamp(vitals.reservoir, 0, stats.maxReservoir),
	};
}
