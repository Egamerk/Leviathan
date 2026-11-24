import { CombatConfig, DetectionConfig } from "shared/config";

/** Trello: Main Systems → Main Stats. */
export interface MainStats {
	strength: number;
	dexterity: number;
	endurance: number;
	occult: number;
	connection: number;
}

export interface DerivedStats {
	maxHealth: number;
	maxStamina: number;
	maxReservoir: number;
	maxAuxiliary: number;
	/** Occult × 0.75 + Connection × 0.25 */
	sanity: number;
	/** Occult × 0.25 + Connection × 0.75 */
	depthAffinity: number;
	parryStrength: number;
	/** Fraction (0..1) subtracted from enemy detection range. */
	stealth: number;
	moveStuds: number;
	hasReservoir: boolean;
}

export interface DeriveOptions {
	/** Extra max health from armor (Trello: armor provides the base 4). */
	armorHealth?: number;
	defense?: number;
	/** Hidden "Speed" attribute for enemies; stacks with Dexterity. */
	speedStuds?: number;
	/** Occultist / Apostle vessels always have Reservoir. */
	innateReservoir?: boolean;
}

export function deriveStats(stats: MainStats, options: DeriveOptions = {}): DerivedStats {
	const depthAffinity = stats.occult * 0.25 + stats.connection * 0.75;
	return {
		maxHealth:
			(options.armorHealth ?? CombatConfig.baseMaxHealth) + stats.endurance * CombatConfig.healthPerEndurance,
		maxStamina: CombatConfig.baseMaxStamina,
		maxReservoir: CombatConfig.baseMaxReservoir,
		maxAuxiliary: CombatConfig.baseMaxAuxiliary,
		sanity: stats.occult * 0.75 + stats.connection * 0.25,
		depthAffinity,
		parryStrength:
			stats.strength * CombatConfig.parryPerStrength + stats.endurance * CombatConfig.parryPerEndurance,
		stealth: math.clamp(stats.dexterity * DetectionConfig.stealthPerDexterity, 0, 0.9),
		moveStuds:
			CombatConfig.baseMoveStuds +
			stats.dexterity * CombatConfig.moveStudsPerDexterity +
			(options.speedStuds ?? 0),
		hasReservoir: options.innateReservoir === true || depthAffinity >= CombatConfig.reservoirAffinityRequirement,
	};
}
