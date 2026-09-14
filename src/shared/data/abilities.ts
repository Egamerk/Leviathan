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
