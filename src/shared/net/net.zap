opt server_output = "zapServer.luau"
opt client_output = "zapClient.luau"
opt casing = "camelCase"
opt typescript = true
opt write_checks = true
opt yield_type = "yield"

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
}
