/**
 * Every gameplay number that came from the Trello board lives here, so balancing
 * never means hunting through systems. Card names are noted next to each block.
 */

/** Trello: Main Systems → Movement (out of combat). */
export const MovementConfig = {
	walkSpeed: 16,
	sprintSpeed: 26,
	crouchSpeed: 8,
	/** Window for the "double tap W" sprint. */
	doubleTapWindow: 0.3,

	dashSpeed: 70,
	dashDuration: 0.18,
	dashCooldown: 1.5,

	wallCheckDistance: 2.5,
	wallClimbVelocity: 48,
	wallBounceUpVelocity: 42,
	wallBounceOutVelocity: 38,
	wallBounceCooldown: 3,

	swimDashSpeed: 60,
	swimDashCooldown: 1.5,
	/** One by default, one more granted by climbing/bouncing. */
	swimDashMaxCharges: 2,

	descendVelocity: 90,
	descendCooldown: 2,

	crouchCooldown: 0.15,

	/** Trello: "cap terminal velocity — falling in water doesn't work like in air". */
	terminalVelocity: 55,
} as const;

/** Voxel navigation grid. One cell = one square column of walkable floors. */
export const NavConfig = {
	cellSize: 2,
	/** Height of the space a combatant needs above a floor. */
	agentHeight: 5,
	/** Cells within this distance (studs) of a wall are eroded so models don't clip. */
	agentRadius: 1.5,
	maxStepHeight: 2.25,
	maxSlopeDegrees: 50,
	/** Max stacked floors per column (bridges, caves, multi-level ruins). */
	maxLayers: 4,
	/** Chunk edge length in cells. Chunks are the unit of lazy baking. */
	chunkCells: 16,
	/** Ray origin height above a chunk's highest point when no bounds are known. */
	defaultCeiling: 400,
	defaultFloor: -400,
	/** Hard cap on A* node expansions so a bad request can't stall the server. */
	maxExpansions: 6000,
} as const;

/** Trello: Out of Combat → Initiative/Encounter, Main Stats → Dexterity (stealth). */
export const DetectionConfig = {
	sightRange: 70,
	fieldOfViewDegrees: 110,
	/** Within this distance an enemy notices you regardless of facing. */
	proximityRange: 8,
	crouchRangeMultiplier: 0.55,
	/** Trello: +1% stealth per Dexterity point. */
	stealthPerDexterity: 0.01,
	/** Suspicion per second at point-blank; scales down with distance. */
	suspicionGainPerSecond: 1.6,
	suspicionDecayPerSecond: 0.35,
	/** Suspicion at which an enemy starts pursuing. */
	pursueThreshold: 1,
	/** Seconds without sight before a pursuer gives up. */
	loseTrackSeconds: 6,
	/** Distance at which a pursuer forces the encounter. */
	engageRange: 7,
	/** Players this close to the trigger point are pulled into the same encounter. */
	encounterJoinRadius: 45,
	/** Facing cone used to decide head-on vs ambush. */
	facingConeDegrees: 120,
	/** Ambient brightness (0..1) above which an area counts as "well lit". */
	litThreshold: 0.5,
} as const;

/** Trello: Combat → Player Turn / Movement/Attack, Main Systems → Energy Types / Health. */
export const CombatConfig = {
	baseInitiative: 5,
	initiativePerDexterity: 0.05,
	minInitiative: 0.01,
	diverStealthInitiativeBonus: 0.25,
	enemyAmbushInitiativePenalty: 0.5,

	baseMoveStuds: 20,
	moveStudsPerDexterity: 1,

	baseMaxHealth: 4,
	healthPerEndurance: 0.5,
	baseMaxStamina: 4,
	staminaRegenPerTurn: 1,
	baseMaxReservoir: 6,
	baseMaxAuxiliary: 2,
	/** Trello: Reservoir unlocks at 3 Depths Affinity (Energy Types card). */
	reservoirAffinityRequirement: 3,

	recoverStamina: 2,
	recoverHealth: 3,
	recoverReservoir: 1,

	/** Trello (QTE card): Parry Strength = Strength × 0.75 + Endurance × 0.25. */
	parryPerStrength: 0.75,
	parryPerEndurance: 0.25,
	/** Below this fraction of the required parry strength: block shatters and you stagger. */
	parryStaggerBelow: 0.33,

	/** Damage ≥ this multiple of max health implodes the diver outright. */
	implodeOverkillRatio: 1.2,

	/** Studs a Move must keep from opposing combatants (Trello: moving too close pushes you back). */
	personalSpace: 3,

	/** Arena radius (studs) carved out of the world grid when an encounter starts. */
	arenaRadius: 40,
	/** Seconds a player has to act before their turn auto-ends. */
	turnTimeout: 60,
	/** Network grace added to every QTE window (seconds). */
	qteLatencyGrace: 0.12,
} as const;
