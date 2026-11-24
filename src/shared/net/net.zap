<<<<<<< HEAD
<<<<<<< HEAD
-- Leviathan network contract. Regenerate with `npm run zap`.
--
-- Client → Server messages are fully typed so Zap validates/limits them before
-- gameplay code sees them. Server → Client combat event batches use `unknown`:
-- they come from a trusted source, are low frequency (turn-based), and mirror the
-- `CombatEvent` union in src/shared/combat/types.ts without duplicating it here.

=======
>>>>>>> parent of 2163304 (Describe what you added or fixed)
=======
>>>>>>> parent of 2163304 (Describe what you added or fixed)
opt server_output = "zapServer.luau"
opt client_output = "zapClient.luau"
opt casing = "camelCase"
opt typescript = true
opt write_checks = true
opt yield_type = "yield"

<<<<<<< HEAD
<<<<<<< HEAD
type Resource = struct {
	current: f32,
	max: f32,
}

type ArenaSnapshot = struct {
	originX: i32,
	originZ: i32,
	width: u16,
	depth: u16,
	cellSize: f32,
	maxStepHeight: f32,
	columns: buffer,
}

type CombatantView = struct {
	id: string.utf8(1..64),
	name: string.utf8(0..64),
	side: enum { diver, enemy },
	control: enum { player, ai },
	userId: f64?,
	defId: string.utf8(0..64),
	node: f64,
	health: Resource,
	stamina: Resource,
	reservoir: Resource?,
	auxiliary: Resource,
	moveStuds: f32,
	abilities: string.utf8(0..64)[],
	model: Instance.Model?,
}

-- ── Exploration ──────────────────────────────────────────────────────────────

event setStance = {
	from: Client,
	type: Reliable,
	call: SingleAsync,
	data: struct {
		crouching: boolean,
		sprinting: boolean,
	},
}

-- Diver-initiated stealth encounter (Trello: Stealth/Assassination Encounters [Diver]).
event engageEnemy = {
	from: Client,
	type: Reliable,
	call: SingleAsync,
	data: struct {
		enemyId: string.utf8(1..64),
	},
}

-- Suspicion meter for the "you're being noticed" UI.
event awareness = {
	from: Server,
	type: Unreliable,
	call: SingleAsync,
	data: struct {
		enemyId: string.utf8(1..64),
		suspicion: f32,
		state: enum { Idle, Suspicious, Pursuing },
	},
}

-- ── Encounters ───────────────────────────────────────────────────────────────

event encounterStarted = {
	from: Server,
	type: Reliable,
	call: SingleAsync,
	data: struct {
		encounterId: string.utf8(1..64),
		kind: enum { HeadOn, DiverStealth, EnemyAmbush },
		center: Vector3,
		arena: ArenaSnapshot,
		combatants: CombatantView[],
	},
}

event combatEvents = {
	from: Server,
	type: Reliable,
	call: SingleAsync,
	data: struct {
		encounterId: string.utf8(1..64),
		events: unknown,
	},
}

event encounterEnded = {
	from: Server,
	type: Reliable,
	call: SingleAsync,
	data: struct {
		encounterId: string.utf8(1..64),
		winner: enum { diver, enemy },
	},
}

event combatCommand = {
	from: Client,
	type: Reliable,
	call: SingleAsync,
	data: enum "type" {
		Move {
			to: f64,
		},
		UseAbility {
			abilityId: string.utf8(1..64),
			targetId: string.utf8(1..64),
		},
		Recover {},
		EndTurn {},
	},
}

-- ── Quick Time Events ────────────────────────────────────────────────────────
-- Times are `workspace:GetServerTimeNow()` so both sides share one clock.

event qteWindow = {
	from: Server,
	type: Reliable,
	call: SingleAsync,
	data: struct {
		windowId: u32,
		kind: enum { Attack, Defense },
		qte: string.utf8(0..32),
		abilityId: string.utf8(0..64),
		opensAt: f64,
		closesAt: f64,
		canParry: boolean,
		canDodge: boolean,
	},
}

event qteInput = {
	from: Client,
	type: Reliable,
	call: SingleAsync,
	data: struct {
		windowId: u32,
		input: enum "type" {
			Hit {
				limb: enum { Head, Torso, LeftArm, RightArm, Legs },
			},
			Parry {},
			Dodge {
				direction: enum { A, S, D },
			},
		},
		pressedAt: f64,
	},
=======
=======
>>>>>>> parent of 2163304 (Describe what you added or fixed)
type ResourceState = struct {
	current: u8,
	max: u8,
}

type CombatantSnapshot = struct {
	guid: string.utf8,
	health: ResourceState,
	stamina: ResourceState,
	initiative: f32,
	movementPoints: f32,
}

type EvadeWindow = struct {
	windowId: string.utf8,
	reaction: string.utf8,
	telegraphAt: f64,
	openAt: f64,
	closeAt: f64,
}

type EvadeSchedule = struct {
	encounterId: string.utf8,
	abilityId: string.utf8,
	windows: EvadeWindow[0..8],
}

type EvadeInput = struct {
	encounterId: string.utf8,
	windowId: string.utf8,
	reaction: string.utf8,
	clientPressTime: f64,
}

type EvadeResult = struct {
	encounterId: string.utf8,
	windowId: string.utf8,
	success: boolean,
	hit: boolean,
}

type CombatAction = struct {
	action: string.utf8,
	abilityId: string.utf8?,
	targetGuid: string.utf8?,
	destX: f32?,
	destY: f32?,
	destZ: f32?,
}

type WorldPoint = struct {
	x: f32,
	y: f32,
	z: f32,
}

type CombatMove = struct {
	encounterId: string.utf8,
	guid: string.utf8,
	path: WorldPoint[1..64],
}

type CombatAnim = struct {
	encounterId: string.utf8,
	guid: string.utf8,
	anim: string.utf8,
	targetGuid: string.utf8?,
}

type EncounterCombatant = struct {
	guid: string.utf8,
	kind: string.utf8,
	x: f32,
	y: f32,
	z: f32,
	health: ResourceState,
	stamina: ResourceState,
	movementPoints: f32,
	mainActionAvailable: boolean,
}

type EncounterSnapshot = struct {
	encounterId: string.utf8,
	round: u8,
	phase: string.utf8,
	actor: string.utf8,
	combatants: EncounterCombatant[0..8],
}

event ready = {
	from: Client,
	type: Reliable,
	call: SingleAsync,
}

event replicateCombatant = {
	from: Server,
	type: Reliable,
	call: SingleAsync,
	data: CombatantSnapshot,
}

event replicateEncounter = {
	from: Server,
	type: Reliable,
	call: SingleAsync,
	data: EncounterSnapshot,
}

event evadeSchedule = {
	from: Server,
	type: Reliable,
	call: SingleAsync,
	data: EvadeSchedule,
}

event evadeResult = {
	from: Server,
	type: Reliable,
	call: SingleAsync,
	data: EvadeResult,
}

event evadeInput = {
	from: Client,
	type: Reliable,
	call: SingleAsync,
	data: EvadeInput,
}

event combatAction = {
	from: Client,
	type: Reliable,
	call: SingleAsync,
	data: CombatAction,
}

event combatMove = {
	from: Server,
	type: Reliable,
	call: SingleAsync,
	data: CombatMove,
}

event combatAnim = {
	from: Server,
	type: Reliable,
	call: SingleAsync,
	data: CombatAnim,
}

funct syncClock = {
	call: Async,
	rets: f64,
<<<<<<< HEAD
>>>>>>> parent of 2163304 (Describe what you added or fixed)
=======
>>>>>>> parent of 2163304 (Describe what you added or fixed)
}
