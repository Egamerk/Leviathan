import type { MainStats } from "shared/rules/stats";
import type { StatusId } from "./statuses";

/** Trello: QTE Types. Which minigame the attacker plays while the move executes. */
export type AttackQteKind = "BasicAttack" | "TargetHit" | "ThreadWeave" | "Osu";
/** Trello: QTE → Dodging. A = sidestep left, S = lean back, D = sidestep right. */
export type DodgeDirection = "A" | "S" | "D";
/** Trello: QTE → Attacking. WASD picks the limb / string; no input = torso. */
export type Limb = "Head" | "Torso" | "LeftArm" | "RightArm" | "Legs";

export type ActionSlot = "main" | "side";

export interface AbilityDef {
	id: string;
	name: string;
	slot: ActionSlot;
	cost: { stamina?: number; reservoir?: number; auxiliary?: number };
	/** Effective range in studs (Trello: Movement/Attack). */
	range: number;
	/** Melee only: how far the attacker may auto-step to reach range without spending Move. */
	autoStep?: number;
	baseDamage: number;
	/** Each entry adds `stat × ratio × SCALING_UNIT` damage. */
	scaling: Array<{ stat: keyof MainStats; ratio: number }>;
	armorPierce?: number;
	/** Omit to make the attack unparryable. */
	parry?: { requiredStrength: number; alwaysParryable?: boolean };
	/** Directions that fully avoid this attack. Omit to make it undodgeable. */
	dodge?: DodgeDirection[];
	attackQte?: AttackQteKind;
	/** Damage multiplier when the attacker fails their QTE. */
	qteFailMultiplier?: number;
	applies?: Array<{ status: StatusId; potency: number; duration: number }>;
	/** Seconds from QTE prompt to impact; drives the defense window timing. */
	windup: number;
}

/** Placeholder scaling unit until the Trello board defines the exact formula. */
export const SCALING_UNIT = 0.1;

export const Abilities = {
	/** Trello: Insight/Loadout — always equipped, never takes a loadout slot. */
	BasicStrike: {
		id: "BasicStrike",
		name: "Strike",
		slot: "main",
		cost: { stamina: 1 },
		range: 5,
		autoStep: 4,
		baseDamage: 1,
		scaling: [
			{ stat: "strength", ratio: 0.5 },
			{ stat: "dexterity", ratio: 0.5 },
		],
		parry: { requiredStrength: 4 },
		dodge: ["A", "D"],
		attackQte: "BasicAttack",
		qteFailMultiplier: 0.5,
		windup: 0.9,
	},
	TideFangLunge: {
		id: "TideFangLunge",
		name: "Tide Fang Lunge",
		slot: "main",
		cost: { stamina: 2 },
		range: 7,
		autoStep: 3,
		baseDamage: 1.5,
		scaling: [{ stat: "dexterity", ratio: 1 }],
		armorPierce: 0.25,
		parry: { requiredStrength: 6 },
		dodge: ["A", "D"],
		attackQte: "TargetHit",
		qteFailMultiplier: 0.4,
		applies: [{ status: "Bleed", potency: 2, duration: 2 }],
		windup: 0.7,
	},
	/** Enemy template weapon (Trello: Enemy Attributes → TEMPLATE CARD, "Burning Dawn"). */
	BurningDawn: {
		id: "BurningDawn",
		name: "Burning Dawn",
		slot: "main",
		cost: {},
		range: 6,
		autoStep: 4,
		baseDamage: 0.75,
		scaling: [{ stat: "strength", ratio: 0.25 }],
		parry: { requiredStrength: 5 },
		dodge: ["S"],
		windup: 1.1,
	},
	DrifterClaw: {
		id: "DrifterClaw",
		name: "Rending Claw",
		slot: "main",
		cost: {},
		range: 5,
		autoStep: 4,
		baseDamage: 0.5,
		scaling: [{ stat: "dexterity", ratio: 0.25 }],
		parry: { requiredStrength: 2, alwaysParryable: true },
		dodge: ["A", "D"],
		applies: [{ status: "Bleed", potency: 1, duration: 2 }],
		windup: 0.8,
	},
} satisfies Record<string, AbilityDef>;

export type AbilityId = keyof typeof Abilities;

export function getAbility(id: string): AbilityDef | undefined {
	return (Abilities as Record<string, AbilityDef>)[id];
}
