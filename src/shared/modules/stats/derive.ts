import { StatsConfig } from "shared/config/stats";
import { type StatPassiveDef, StatPassives } from "shared/definitions/stat-passives";
import { Vessels, type VesselId } from "shared/definitions/vessels";
import { type DerivedStats, MAIN_STATS, type MainStat, type MainStats } from "./types";

const P = StatsConfig.perPoint;
const B = StatsConfig.base;

/** Allocated points + vessel bonus, clamped to the stat cap. */
export function totalStats(allocated: Readonly<MainStats>, vessel?: VesselId): MainStats {
	const totals = { ...allocated };
	if (vessel !== undefined) totals[Vessels.get(vessel).stat] += StatsConfig.vesselStatBonus;
	for (const stat of MAIN_STATS) totals[stat] = math.clamp(totals[stat], 0, StatsConfig.statCap);
	return totals;
}

function meetsRequirements(def: StatPassiveDef, totals: MainStats, sanity: number, depthAffinity: number): boolean {
	for (const [key, required] of pairs(def.requires)) {
		const value = key === "sanity" ? sanity : key === "depthAffinity" ? depthAffinity : totals[key as MainStat];
		if (value < required) return false;
	}
	return true;
}

/**
 * Pure: the same inputs always give the same output on server and client.
 * Combat, movement and detection read their numbers from here instead of
 * re-deriving them.
 */
export function deriveStats(allocated: Readonly<MainStats>, vessel?: VesselId): DerivedStats {
	const t = totalStats(allocated, vessel);

	const sanity = t.occult * P.occult.sanity + t.connection * P.connection.sanity;
	const depthAffinity = t.occult * P.occult.depthAffinity + t.connection * P.connection.depthAffinity;

	const passives = new Array<string>();
	let passiveParry = 0;
	let parryChipReduction = 0;
	for (const id of StatPassives.ids) {
		const def = StatPassives.get(id);
		if (!meetsRequirements(def, t, sanity, depthAffinity)) continue;
		passives.push(id);
		passiveParry += def.modifiers?.parryStrength ?? 0;
		parryChipReduction += def.modifiers?.parryChipReduction ?? 0;
	}

	const innateReservoir = vessel !== undefined && Vessels.get(vessel).innateReservoir;
	const hasReservoir = innateReservoir || depthAffinity >= StatsConfig.reservoirDepthAffinity;

	return {
		totals: t,

		strengthScaling: t.dexterity * P.dexterity.strengthScaling,
		dexterityScaling: t.strength * P.strength.dexterityScaling,
		parryStrength: t.strength * P.strength.parryStrength + t.endurance * P.endurance.parryStrength + passiveParry,
		parryChipReduction,
		dodgeWindowSeconds: B.dodgeWindowSeconds + t.dexterity * P.dexterity.dodgeWindowSeconds,
		stealth: math.min(t.dexterity * P.dexterity.stealth, StatsConfig.maxStealth),
		explorationSpeedMultiplier: 1 + t.dexterity * P.dexterity.explorationSpeed,
		combatMoveStuds: B.combatMoveStuds + t.dexterity * P.dexterity.combatMoveStuds,
		physicalAilmentResistance: math.min(t.endurance * P.endurance.physicalAilmentResistance, 1),

		sanity,
		depthAffinity,
		ailmentPotency: t.occult * P.occult.ailmentPotency,
		mentalAilmentResistance: math.min(t.connection * P.connection.mentalAilmentResistance, 1),

		maxHealth: B.maxHealth + t.endurance * P.endurance.maxHealth,
		maxStamina: B.maxStamina,
		maxAuxiliary: B.maxAuxiliary,
		maxReservoir: hasReservoir ? B.maxReservoir : 0,
		hasReservoir,

		baseInitiative: B.initiative + t.dexterity * P.dexterity.initiative,

		passives,
	};
}

export type AllocationError = "InvalidAmount" | "NotEnoughPoints" | "StatCapped";

/**
 * Validates spending `amount` points on `stat`. Returns undefined when
 * allowed. Shared so the UI can disable buttons with the server's exact rules.
 */
export function checkAllocation(
	allocated: Readonly<MainStats>,
	unspent: number,
	stat: MainStat,
	amount: number,
	vessel?: VesselId,
): AllocationError | undefined {
	if (amount < 1 || amount % 1 !== 0) return "InvalidAmount";
	if (amount > unspent) return "NotEnoughPoints";
	const vesselBonus = vessel !== undefined && Vessels.get(vessel).stat === stat ? StatsConfig.vesselStatBonus : 0;
	if (allocated[stat] + vesselBonus + amount > StatsConfig.statCap) return "StatCapped";
	return undefined;
}
