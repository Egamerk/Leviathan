<<<<<<< HEAD
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
=======
export type ReactionType = "parry" | "dodge";
export type ReactionTier = "trash" | "elite" | "boss";

export interface AbilityWindowDefinition {
	/** Hittable open duration (seconds). */
	durationSeconds: number;
	/** Cue lead before the window opens (seconds). 0 = no telegraph. */
	telegraphSeconds: number;
	/** The distinct player action required to answer this window. */
	reaction: ReactionType;
}

export interface AbilityDefinition {
	name: string;
	cooldownSeconds: number;
	damage: number;
	/** Horizontal world-space range in studs required to use this ability. */
	range: number;
	/** Stamina spent when the player uses this as a main action. */
	staminaCost: number;
	reactionTier: ReactionTier;
	interWindowGapSeconds?: number;
	/**
	 * Ordered reaction windows for attacks that permit a reaction.
	 * Trash attacks omit this, elites use 1–2 windows, and boss/signature
	 * attacks may use full multi-beat chains.
	 * Runtime open/close clocks belong in ECS — this is authored timing only.
	 */
	windows?: readonly AbilityWindowDefinition[];
}

/**
 * Locked timings for a full boss/signature chain with cascading opens.
 *
 * - w0: longer hittable + full cold-start telegraph
 * - w1: standard hittable + short telegraph (first live beat after predecessor)
 * - w2: standard hittable, no telegraph (warm continuation)
 */
export const BASELINE_REACTION_WINDOWS = [
	{ durationSeconds: 0.4, telegraphSeconds: 0.175, reaction: "parry" },
	{ durationSeconds: 0.28, telegraphSeconds: 0.09, reaction: "dodge" },
	{ durationSeconds: 0.28, telegraphSeconds: 0, reaction: "parry" },
] as const satisfies readonly AbilityWindowDefinition[];

/** Static authored data. Runtime cooldowns belong in ECS components. */
export const ABILITY_DEFINITIONS = {
	basicAttack: {
		name: "Basic Attack",
		cooldownSeconds: 1,
		damage: 1,
		range: 4,
		staminaCost: 0,
		reactionTier: "trash",
	},
	eliteDoubleStrike: {
		name: "Elite Double Strike",
		cooldownSeconds: 4,
		damage: 1,
		range: 4,
		staminaCost: 0,
		reactionTier: "elite",
		interWindowGapSeconds: 0.15,
		windows: [BASELINE_REACTION_WINDOWS[0], BASELINE_REACTION_WINDOWS[1]],
	},
	/** Boss-tier example that preserves the locked full-chain timings. */
	bossSignatureChain: {
		name: "Boss Signature Chain",
		cooldownSeconds: 8,
		damage: 1,
		range: 4,
		staminaCost: 0,
		reactionTier: "boss",
		interWindowGapSeconds: 0.15,
		windows: BASELINE_REACTION_WINDOWS,
	},
} satisfies Record<string, AbilityDefinition>;

export type AbilityId = keyof typeof ABILITY_DEFINITIONS;
>>>>>>> parent of 2163304 (Describe what you added or fixed)
