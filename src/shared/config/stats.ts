/**
 * Base stat tunables (Trello: Main Systems → Main Stats, Health, Energy Types,
 * Universal Passives, Out of Combat → Initiative, The Vessels).
 *
 * Values marked PLACEHOLDER aren't defined on the board yet. Values marked
 * CONFLICT differ between cards. See docs/STATS.md for both lists.
 */
export const StatsConfig = {
	/** Trello: "{Scaled by 35 Max} +15 possibly". Max total per stat. */
	statCap: 35,
	/** The "+15 possibly" headroom; raise `statCap` to this if it's adopted. */
	statCapExtended: 50,
	/** Points invested in the vessel's stat at creation (Trello: The Vessels). */
	vesselStatBonus: 3,
	/** Unspent stat points a brand-new character starts with. PLACEHOLDER (contracts grant more). */
	startingStatPoints: 0,

	perPoint: {
		strength: {
			/** "Increases Dexterity Scaling by 0.5" */
			dexterityScaling: 0.5,
			/** "[0.5 Parry Scaling per point]". CONFLICT: the QTE card says 0.75. */
			parryStrength: 0.5,
		},
		dexterity: {
			/** "Increases Strength Scaling by 0.5" */
			strengthScaling: 0.5,
			/** "Increases the dodge frames by 0.02 seconds per 1" */
			dodgeWindowSeconds: 0.02,
			/** "Increases Stealth by 1% per point" (shrinks enemy detection range) */
			stealth: 0.01,
			/** Out-of-combat speed/climb/swim-dash multiplier per point. PLACEHOLDER */
			explorationSpeed: 0.01,
			/** Extra combat move distance (studs) per point. PLACEHOLDER */
			combatMoveStuds: 1,
			/** Trello: Initiative "slight scaling with Dexterity [0.05 Per]" */
			initiative: 0.05,
		},
		endurance: {
			/** "Increases Health by 0.5 per point" */
			maxHealth: 0.5,
			/** "Adds [0.25 Parry Scaling] per point" */
			parryStrength: 0.25,
			/** Physical ailment resistance per point (fraction). PLACEHOLDER */
			physicalAilmentResistance: 0.01,
		},
		occult: {
			/** "Increases Sanity/Willpower by 0.75 per point" */
			sanity: 0.75,
			/** "Increases Depth Affinity by 0.25 per point" */
			depthAffinity: 0.25,
			/** Inflicted ailment effectiveness per point (fraction). PLACEHOLDER */
			ailmentPotency: 0.01,
		},
		connection: {
			/** "Increases Sanity/Willpower by 0.25 per point" */
			sanity: 0.25,
			/** "Increases Depth Affinity by 0.75 per point" */
			depthAffinity: 0.75,
			/** Mental ailment resistance per point (fraction). PLACEHOLDER */
			mentalAilmentResistance: 0.01,
		},
	},

	base: {
		/** Trello: Health — "a base of 4 maximum health, provided by their armor". */
		maxHealth: 4,
		/** Trello: Energy Types — "a max of 4 Stamina". */
		maxStamina: 4,
		/** Trello: Energy Types — "a base 2 Auxiliary Points due to their armor". */
		maxAuxiliary: 2,
		/** Trello: Energy Types — "By default you will have 6 Max Reservoir". */
		maxReservoir: 6,
		/** Trello: Initiative — "By default the player will start with 5 Initiative". */
		initiative: 5,
		/** Base combat move distance (studs) before Dexterity. PLACEHOLDER */
		combatMoveStuds: 20,
		/** Base dodge window (seconds) before Dexterity. PLACEHOLDER */
		dodgeWindowSeconds: 0.2,
	},

	/**
	 * Depth Affinity needed to unlock Reservoir. CONFLICT: Energy Types and
	 * Combat → Player Turn say 3; Universal Passives says 5.
	 */
	reservoirDepthAffinity: 3,
	/** Stealth can't make you fully invisible. PLACEHOLDER */
	maxStealth: 0.9,
} as const;
