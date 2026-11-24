/** The five main stats (Trello: Main Systems → Main Stats). */
export const MAIN_STATS = ["strength", "dexterity", "endurance", "occult", "connection"] as const;

export type MainStat = (typeof MAIN_STATS)[number];

export type MainStats = Record<MainStat, number>;

/** Everything computed from main stats + vessel + unlocked passives. */
export interface DerivedStats {
	/** Final main stat totals (allocated + vessel bonus). */
	readonly totals: Readonly<MainStats>;

	// Physical
	readonly strengthScaling: number;
	readonly dexterityScaling: number;
	readonly parryStrength: number;
	/** Extra damage negated when parrying (fraction). From passives. */
	readonly parryChipReduction: number;
	readonly dodgeWindowSeconds: number;
	readonly stealth: number;
	/** Multiplier for out-of-combat speed / climb / swim dash. */
	readonly explorationSpeedMultiplier: number;
	readonly combatMoveStuds: number;
	readonly physicalAilmentResistance: number;

	// Mind
	readonly sanity: number;
	readonly depthAffinity: number;
	readonly ailmentPotency: number;
	readonly mentalAilmentResistance: number;

	// Pools
	readonly maxHealth: number;
	readonly maxStamina: number;
	readonly maxAuxiliary: number;
	/** 0 when Reservoir is locked. */
	readonly maxReservoir: number;
	readonly hasReservoir: boolean;

	/** Initiative at full health (combat scales it by current health). */
	readonly baseInitiative: number;

	/** Ids of universal passives whose requirements are met. */
	readonly passives: readonly string[];
}

export function emptyStats(): MainStats {
	return { strength: 0, dexterity: 0, endurance: 0, occult: 0, connection: 0 };
}
