import { CombatConfig } from "shared/config";

/**
 * Trello: Main Systems → Defense.
 * Flat reduction; Armor Pierce (AP) negates defense point for point.
 *   1 dmg vs 0.25 def           → 0.75
 *   1 dmg, 1 AP vs 1 def        → 1
 */
export function applyDefense(damage: number, defense: number, armorPierce = 0): number {
	const effectiveDefense = math.max(0, defense - armorPierce);
	return math.max(0, damage - effectiveDefense);
}

export type ParryOutcome = "Parried" | "Shattered" | "ShatteredStagger";

/**
 * Trello: Main Systems → Quick Time Events → Parrying.
 * ≥ 100% of the required strength fully parries; below 33% shatters your block and
 * staggers you; in between the block shatters and you take the hit.
 */
export function resolveParry(parryStrength: number, requiredStrength: number, alwaysParryable: boolean): ParryOutcome {
	if (alwaysParryable || requiredStrength <= 0) return "Parried";
	const ratio = parryStrength / requiredStrength;
	if (ratio >= 1) return "Parried";
	if (ratio < CombatConfig.parryStaggerBelow) return "ShatteredStagger";
	return "Shattered";
}

/** Trello: Enemy Attributes → Dexterity. Enemy dodge chance, reduced by the attacker's Dexterity. */
export function enemyDodgeChance(enemyDexterity: number, attackerDexterity: number): number {
	return math.clamp((enemyDexterity - attackerDexterity) * 0.03 + 0.05, 0, 0.6);
}

/** Trello: Enemy Attributes → Strength. Enemy parry chance against parryable attacks within their strength. */
export function enemyParryChance(enemyStrength: number, attackerStrength: number): number {
	return math.clamp((enemyStrength - attackerStrength) * 0.04 + 0.05, 0, 0.6);
}

/** Trello: Health card. Overkill beyond 120% of max health implodes the diver. */
export function isImplosion(damage: number, maxHealth: number): boolean {
	return damage >= maxHealth * CombatConfig.implodeOverkillRatio;
}
