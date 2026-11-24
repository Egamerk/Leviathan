import type { Entity, World } from "@rbxts/jecs";
import { Players, Workspace } from "@rbxts/services";
import {
	Combatant,
	CombatantType,
	CombatEncounter,
	BASE_INITIATIVE,
	DEFAULT_MOVEMENT_POINTS,
	EvadeWindow,
	Guid,
	Health,
	Initiative,
	MainActionAvailable,
	MAX_HEALTH,
	MAX_STAMINA,
	MovementPoints,
	ResolvedEvade,
	Stamina,
	WorldPos,
	calculateInitiative,
} from "shared/ecs/components";
import type { EncounterState } from "shared/ecs/components";
import { gameBus } from "shared/ecs/bus";
import {
	ABILITY_DEFINITIONS,
	type AbilityDefinition,
	type AbilityId,
} from "shared/data/abilities";
import {
	ENEMY_SPAWN_OFFSET,
	horizontalDistance,
	horizontalOffset,
	inMeleeRange,
	isOccupied,
	MELEE_RANGE_STUDS,
	pullAwayFromOccupants,
	toWorldPoint,
	trimPathToBudget,
} from "shared/data/combatNav";
import { computeWorldPath } from "shared/data/worldPath";
import type {
	CombatAnim,
	EncounterActor,
	EncounterCombatantSnapshot,
	EncounterSnapshot,
	EvadeSchedule,
	WorldPoint,
} from "shared/net/types";
import { createGuid } from "shared/util";
import { world as gameWorld } from "shared/ecs/world";
import {
	drainNetworkIntents,
	takeCombatActions,
	takeEvadeInputs,
} from "server/combat/intents";
import { publishCombatantState } from "server/combat/combatantState";
import {
	destroyEncounterActors,
	groundPositionAt,
	modelGroundPosition,
	spawnEncounterActors,
} from "server/combat/actors";

const MIN_SCHEDULE_LEAD_SECONDS = 0.1;
const MAX_SCHEDULE_LEAD_SECONDS = 0.3;
const NETWORK_JITTER_ALLOWANCE = 0.075;
const MAX_COMPENSATED_LATENCY = 0.15;

interface EncounterHandle {
	encounterEntity: Entity;
	playerEntity: Entity;
	enemyEntity: Entity;
}

interface PendingPlayer {
	userId: number;
	combatantEntity: Entity;
}

interface PendingDamage {
	target: Entity;
	amount: number;
}

interface CompletedPlayerMove {
	userId: number;
	encounterId: string;
	path?: Vector3[];
	cost: number;
	landing?: Vector3;
}

interface CompletedEnemyNav {
	userId: number;
	encounterId: string;
	path?: Vector3[];
	cost: number;
	landing?: Vector3;
}

const encountersByUserId = new Map<number, EncounterHandle>();
const pendingPlayers: PendingPlayer[] = [];
const pendingDamage: PendingDamage[] = [];
const inFlightNav = new Set<string>();
const completedPlayerMoves: CompletedPlayerMove[] = [];
const completedEnemyNav: CompletedEnemyNav[] = [];

function navKey(encounterId: string, kind: "player" | "enemy"): string {
	return `${encounterId}:${kind}`;
}

function presentMove(userId: number, encounterId: string, guid: string, path: readonly Vector3[]): void {
	if (path.size() < 2) return;
	const points = new Array<WorldPoint>();
	for (const point of path) {
		points.push(toWorldPoint(point));
	}
	gameBus.publish("CombatMovePresented", {
		userId,
		move: {
			encounterId,
			guid,
			path: points,
		},
	});
}

function presentAnim(
	userId: number,
	encounterId: string,
	guid: string,
	anim: CombatAnim["anim"],
	targetGuid?: string,
): void {
	const payload: CombatAnim = {
		encounterId,
		guid,
		anim,
	};
	if (targetGuid !== undefined) payload.targetGuid = targetGuid;
	gameBus.publish("CombatAnimPresented", {
		userId,
		anim: payload,
	});
}

function getNetworkLatency(userId: number): number {
	const player = Players.GetPlayerByUserId(userId);
	const roundTripSeconds = player?.GetNetworkPing() ?? 0;
	return math.clamp(roundTripSeconds / 2, 0, MAX_COMPENSATED_LATENCY);
}

function resolveEncounterActor(world: World, encounter: EncounterState): EncounterActor {
	if (encounter.phase === "complete") return "none";
	const actor = encounter.order[encounter.turnIndex];
	if (actor === undefined || !world.contains(actor)) return "none";
	const kind = world.get(actor, CombatantType);
	return kind === "player" || kind === "enemy" ? kind : "none";
}

function readCombatantSnapshot(world: World, entity: Entity): EncounterCombatantSnapshot | undefined {
	const guid = world.get(entity, Guid);
	const kind = world.get(entity, CombatantType);
	const pos = world.get(entity, WorldPos);
	const health = world.get(entity, Health);
	const stamina = world.get(entity, Stamina);
	const movementPoints = world.get(entity, MovementPoints);
	if (
		guid === undefined ||
		kind === undefined ||
		pos === undefined ||
		health === undefined ||
		stamina === undefined ||
		movementPoints === undefined
	) {
		return undefined;
	}

	return {
		guid,
		kind,
		x: pos.X,
		y: pos.Y,
		z: pos.Z,
		health: { current: health.current, max: health.max },
		stamina: { current: stamina.current, max: stamina.max },
		movementPoints,
		mainActionAvailable: world.get(entity, MainActionAvailable) === true,
	};
}

function buildEncounterSnapshot(world: World, encounter: EncounterState, handle: EncounterHandle): EncounterSnapshot {
	const combatants: EncounterCombatantSnapshot[] = [];
	const playerSnap = readCombatantSnapshot(world, handle.playerEntity);
	const enemySnap = readCombatantSnapshot(world, handle.enemyEntity);
	if (playerSnap !== undefined) combatants.push(playerSnap);
	if (enemySnap !== undefined) combatants.push(enemySnap);

	return {
		encounterId: encounter.id,
		round: encounter.round,
		phase: encounter.phase,
		actor: resolveEncounterActor(world, encounter),
		combatants,
	};
}

function publishEncounter(world: World, encounter: EncounterState, handle?: EncounterHandle): void {
	const resolved = handle ?? encountersByUserId.get(encounter.userId);
	if (resolved === undefined) return;
	gameBus.publish("EncounterChanged", {
		userId: encounter.userId,
		snapshot: buildEncounterSnapshot(world, encounter, resolved),
	});
}

function setEncounter(
	world: World,
	encounterEntity: Entity,
	encounter: EncounterState,
	handle?: EncounterHandle,
): void {
	world.set(encounterEntity, CombatEncounter, encounter);
	publishEncounter(world, encounter, handle);
}

function applyDamage(world: World, target: Entity, amount: number): void {
	const health = world.get(target, Health);
	if (health === undefined) return;

	const nextHealth = {
		current: math.max(0, health.current - amount),
		max: health.max,
	};
	world.set(target, Health, nextHealth);
	world.set(target, Initiative, calculateInitiative(nextHealth));
	publishCombatantState(target);
}

function occupiedPositions(world: World, handle: EncounterHandle, ignore?: Entity): Vector3[] {
	const positions: Vector3[] = [];
	for (const entity of [handle.playerEntity, handle.enemyEntity]) {
		if (entity === ignore || !world.contains(entity)) continue;
		const pos = world.get(entity, WorldPos);
		if (pos !== undefined) positions.push(pos);
	}
	return positions;
}

function spawnPositions(userId: number): { playerPos: Vector3; enemyPos: Vector3 } {
	const player = Players.GetPlayerByUserId(userId);
	const character = player?.Character;
	if (character === undefined) {
		const playerPos = new Vector3(0, 0, 0);
		return {
			playerPos,
			enemyPos: groundPositionAt(playerPos.add(new Vector3(ENEMY_SPAWN_OFFSET, 0, 0))),
		};
	}

	const playerPos = modelGroundPosition(character);
	const root = character.FindFirstChild("HumanoidRootPart");
	let dir = new Vector3(1, 0, 0);
	if (root?.IsA("BasePart") === true) {
		const look = new Vector3(root.CFrame.LookVector.X, 0, root.CFrame.LookVector.Z);
		if (look.Magnitude > 0.1) dir = look.Unit;
	}
	const enemyPos = groundPositionAt(playerPos.add(dir.mul(ENEMY_SPAWN_OFFSET)), character);
	return { playerPos, enemyPos };
}

function findEntityByGuid(world: World, handle: EncounterHandle, guid: string): Entity | undefined {
	for (const entity of [handle.playerEntity, handle.enemyEntity]) {
		if (world.contains(entity) && world.get(entity, Guid) === guid) return entity;
	}
	return undefined;
}

function createEncounter(world: World, pending: PendingPlayer): void {
	if (!world.contains(pending.combatantEntity) || encountersByUserId.has(pending.userId)) return;

	const { playerPos, enemyPos } = spawnPositions(pending.userId);
	world.set(pending.combatantEntity, WorldPos, playerPos);
	world.set(pending.combatantEntity, MovementPoints, DEFAULT_MOVEMENT_POINTS);
	world.set(pending.combatantEntity, MainActionAvailable, false);

	const enemyEntity = world.entity();
	world.add(enemyEntity, Combatant);
	world.set(enemyEntity, CombatantType, "enemy");
	world.set(enemyEntity, Guid, createGuid());
	world.set(enemyEntity, Health, { current: MAX_HEALTH, max: MAX_HEALTH });
	world.set(enemyEntity, Stamina, { current: MAX_STAMINA, max: MAX_STAMINA });
	world.set(enemyEntity, Initiative, BASE_INITIATIVE);
	world.set(enemyEntity, MovementPoints, DEFAULT_MOVEMENT_POINTS);
	world.set(enemyEntity, MainActionAvailable, false);
	world.set(enemyEntity, WorldPos, enemyPos);

	const encounterEntity = world.entity();
	const encounter: EncounterState = {
		id: createGuid(),
		userId: pending.userId,
		round: 1,
		turnIndex: 0,
		order: [pending.combatantEntity, enemyEntity],
		phase: "roundStart",
	};
	const handle: EncounterHandle = {
		encounterEntity,
		playerEntity: pending.combatantEntity,
		enemyEntity,
	};
	encountersByUserId.set(pending.userId, handle);
	const playerGuid = world.get(pending.combatantEntity, Guid);
	const enemyGuid = world.get(enemyEntity, Guid);
	if (playerGuid !== undefined && enemyGuid !== undefined) {
		spawnEncounterActors(pending.userId, playerGuid, enemyGuid, playerPos, enemyPos);
	}
	setEncounter(world, encounterEntity, encounter, handle);
	publishCombatantState(pending.combatantEntity);
}

function sortInitiative(world: World, order: Entity[]): Entity[] {
	return [...order].sort((left, right) => {
		const leftInitiative = world.get(left, Initiative) ?? 0;
		const rightInitiative = world.get(right, Initiative) ?? 0;
		if (leftInitiative !== rightInitiative) return leftInitiative > rightInitiative;
		return world.get(left, CombatantType) === "player" && world.get(right, CombatantType) !== "player";
	});
}

function startActorTurn(
	world: World,
	encounterEntity: Entity,
	encounter: EncounterState,
	handle: EncounterHandle,
): void {
	const actor = encounter.order[encounter.turnIndex];
	if (actor === undefined || !world.contains(actor)) return;

	const stamina = world.get(actor, Stamina);
	if (stamina !== undefined) {
		world.set(actor, Stamina, {
			current: math.min(stamina.max, stamina.current + 1),
			max: stamina.max,
		});
	}
	world.set(actor, MovementPoints, DEFAULT_MOVEMENT_POINTS);

	const kind = world.get(actor, CombatantType);
	if (kind === "player") {
		world.set(actor, MainActionAvailable, true);
		setEncounter(world, encounterEntity, { ...encounter, phase: "awaitingAction" }, handle);
		publishCombatantState(actor);
	} else {
		world.set(actor, MainActionAvailable, false);
		setEncounter(world, encounterEntity, { ...encounter, phase: "enemyAttack" }, handle);
	}
}

function advanceTurn(
	world: World,
	encounterEntity: Entity,
	encounter: EncounterState,
	handle: EncounterHandle,
): void {
	const nextIndex = encounter.turnIndex + 1;
	if (nextIndex >= encounter.order.size()) {
		setEncounter(
			world,
			encounterEntity,
			{
				...encounter,
				round: encounter.round + 1,
				turnIndex: 0,
				phase: "roundStart",
			},
			handle,
		);
	} else {
		setEncounter(
			world,
			encounterEntity,
			{
				...encounter,
				turnIndex: nextIndex,
				phase: "actorTurn",
			},
			handle,
		);
	}
}

function chooseEnemyAbility(round: number): AbilityId {
	const tierIndex = (round - 1) % 3;
	if (tierIndex === 0) return "bossSignatureChain";
	if (tierIndex === 1) return "eliteDoubleStrike";
	return "basicAttack";
}

function enemyStandOff(current: Vector3, target: Vector3, occupants: readonly Vector3[]): Vector3 {
	const away = horizontalOffset(target, current);
	const standOff = away.Magnitude > 0.1 ? away.Unit.mul(MELEE_RANGE_STUDS) : new Vector3(MELEE_RANGE_STUDS, 0, 0);
	return pullAwayFromOccupants(new Vector3(target.X + standOff.X, current.Y, target.Z + standOff.Z), occupants);
}

function trimComputedPath(
	from: Vector3,
	to: Vector3,
	budget: number,
): { path: Vector3[]; cost: number; landing: Vector3 } | undefined {
	const raw = computeWorldPath(from, to);
	if (raw === undefined) return undefined;
	const trimmed = trimPathToBudget(raw, budget);
	if (trimmed.path.size() < 2 || trimmed.cost <= 0.05) return undefined;
	const landing = trimmed.path[trimmed.path.size() - 1];
	if (landing === undefined) return undefined;
	return { path: trimmed.path, cost: trimmed.cost, landing };
}

function enqueuePlayerMove(world: World, handle: EncounterHandle, encounter: EncounterState, destination: Vector3): void {
	const key = navKey(encounter.id, "player");
	if (inFlightNav.has(key)) return;

	const current = world.get(handle.playerEntity, WorldPos);
	const mp = world.get(handle.playerEntity, MovementPoints);
	if (current === undefined || mp === undefined || mp <= 0) return;

	const occupants = occupiedPositions(world, handle, handle.playerEntity);
	const adjusted = pullAwayFromOccupants(destination, occupants);
	if (isOccupied(adjusted, occupants)) return;

	const encounterId = encounter.id;
	const userId = encounter.userId;
	inFlightNav.add(key);
	task.spawn(() => {
		const walked = trimComputedPath(current, adjusted, mp);
		completedPlayerMoves.push({
			userId,
			encounterId,
			path: walked?.path,
			cost: walked?.cost ?? 0,
			landing: walked?.landing,
		});
	});
}

function applyCompletedPlayerMoves(world: World): void {
	const jobs = [...completedPlayerMoves];
	completedPlayerMoves.clear();
	for (const job of jobs) {
		inFlightNav.delete(navKey(job.encounterId, "player"));
		if (job.path === undefined || job.landing === undefined || job.path.size() < 2) continue;

		const handle = encountersByUserId.get(job.userId);
		if (handle === undefined) continue;
		const encounter = world.get(handle.encounterEntity, CombatEncounter);
		if (encounter === undefined || encounter.id !== job.encounterId || encounter.phase !== "awaitingAction") {
			continue;
		}

		const mp = world.get(handle.playerEntity, MovementPoints);
		if (mp === undefined || job.cost > mp + 0.05) continue;
		const occupants = occupiedPositions(world, handle, handle.playerEntity);
		if (isOccupied(job.landing, occupants)) continue;

		world.set(handle.playerEntity, WorldPos, job.landing);
		world.set(handle.playerEntity, MovementPoints, math.max(0, mp - job.cost));
		publishCombatantState(handle.playerEntity);
		const guid = world.get(handle.playerEntity, Guid);
		if (guid !== undefined) presentMove(encounter.userId, encounter.id, guid, job.path);
		publishEncounter(world, encounter, handle);
	}
}

function enqueueEnemyTurn(world: World, encounter: EncounterState, handle: EncounterHandle): void {
	const key = navKey(encounter.id, "enemy");
	if (inFlightNav.has(key)) return;

	const playerPos = world.get(handle.playerEntity, WorldPos);
	const enemyPos = world.get(handle.enemyEntity, WorldPos);
	if (playerPos !== undefined && enemyPos !== undefined && inMeleeRange(enemyPos, playerPos)) {
		resolveEnemyOffense(world, handle.encounterEntity, encounter, handle);
		return;
	}

	const mp = world.get(handle.enemyEntity, MovementPoints) ?? 0;
	const occupants = occupiedPositions(world, handle, handle.enemyEntity);
	const destination =
		playerPos !== undefined && enemyPos !== undefined ? enemyStandOff(enemyPos, playerPos, occupants) : undefined;

	const encounterId = encounter.id;
	const userId = encounter.userId;
	const from = enemyPos;
	inFlightNav.add(key);
	task.spawn(() => {
		const walked =
			from !== undefined && destination !== undefined && mp > 0 ? trimComputedPath(from, destination, mp) : undefined;
		completedEnemyNav.push({
			userId,
			encounterId,
			path: walked?.path,
			cost: walked?.cost ?? 0,
			landing: walked?.landing,
		});
	});
}

function applyCompletedEnemyNav(world: World): void {
	const jobs = [...completedEnemyNav];
	completedEnemyNav.clear();
	for (const job of jobs) {
		inFlightNav.delete(navKey(job.encounterId, "enemy"));
		const handle = encountersByUserId.get(job.userId);
		if (handle === undefined) continue;
		const encounter = world.get(handle.encounterEntity, CombatEncounter);
		if (encounter === undefined || encounter.id !== job.encounterId || encounter.phase !== "enemyAttack") {
			continue;
		}

		if (job.path !== undefined && job.landing !== undefined && job.path.size() >= 2) {
			const mp = world.get(handle.enemyEntity, MovementPoints) ?? 0;
			const occupants = occupiedPositions(world, handle, handle.enemyEntity);
			if (job.cost <= mp + 0.05 && !isOccupied(job.landing, occupants)) {
				world.set(handle.enemyEntity, WorldPos, job.landing);
				world.set(handle.enemyEntity, MovementPoints, math.max(0, mp - job.cost));
				const guid = world.get(handle.enemyEntity, Guid);
				if (guid !== undefined) presentMove(encounter.userId, encounter.id, guid, job.path);
			}
		}

		resolveEnemyOffense(world, handle.encounterEntity, encounter, handle);
	}
}

function resolveEnemyOffense(
	world: World,
	encounterEntity: Entity,
	encounter: EncounterState,
	handle: EncounterHandle,
): void {
	const playerPos = world.get(handle.playerEntity, WorldPos);
	const enemyPos = world.get(handle.enemyEntity, WorldPos);
	const enemyGuid = world.get(handle.enemyEntity, Guid);
	const playerGuid = world.get(handle.playerEntity, Guid);

	if (playerPos === undefined || enemyPos === undefined || !inMeleeRange(enemyPos, playerPos)) {
		advanceTurn(world, encounterEntity, encounter, handle);
		return;
	}

	const abilityId = chooseEnemyAbility(encounter.round);
	const ability: AbilityDefinition = ABILITY_DEFINITIONS[abilityId];
	const definitions = ability.windows;

	if (definitions === undefined || definitions.size() === 0) {
		if (enemyGuid !== undefined) {
			presentAnim(encounter.userId, encounter.id, enemyGuid, "attack", playerGuid);
		}
		pendingDamage.push({ target: handle.playerEntity, amount: ability.damage });
		advanceTurn(world, encounterEntity, encounter, handle);
		return;
	}

	const schedule: EvadeSchedule = {
		encounterId: encounter.id,
		abilityId,
		windows: [],
	};
	const scheduleLead = math.clamp(
		getNetworkLatency(encounter.userId) + NETWORK_JITTER_ALLOWANCE,
		MIN_SCHEDULE_LEAD_SECONDS,
		MAX_SCHEDULE_LEAD_SECONDS,
	);
	let cursor = Workspace.GetServerTimeNow() + scheduleLead;
	const gap = ability.interWindowGapSeconds ?? 0;

	for (let index = 0; index < definitions.size(); index += 1) {
		const definition = definitions[index];
		if (definition === undefined) continue;
		const telegraphAt = cursor;
		const openAt = telegraphAt + definition.telegraphSeconds;
		const closeAt = openAt + definition.durationSeconds;
		const windowId = `${encounter.id}:${encounter.round}:${index}:${createGuid()}`;
		schedule.windows.push({
			windowId,
			reaction: definition.reaction,
			telegraphAt,
			openAt,
			closeAt,
		});

		const windowEntity = world.entity();
		world.set(windowEntity, EvadeWindow, {
			encounterId: encounter.id,
			windowId,
			target: handle.playerEntity,
			targetUserId: encounter.userId,
			reaction: definition.reaction,
			openAt,
			closeAt,
			damage: ability.damage,
		});
		cursor = closeAt + gap;
	}

	gameBus.publish("EvadeScheduled", { userId: encounter.userId, schedule });
	if (enemyGuid !== undefined) {
		presentAnim(encounter.userId, encounter.id, enemyGuid, "attack", playerGuid);
	}
	setEncounter(world, encounterEntity, { ...encounter, phase: "resolvingEvade" }, handle);
}

function encounterHasWindows(world: World, encounterId: string): boolean {
	for (const [, window] of world.query(EvadeWindow)) {
		if (window.encounterId === encounterId) return true;
	}
	return false;
}

function cancelEncounterWindows(world: World, encounter: EncounterState): void {
	const entities: Entity[] = [];
	for (const [entity, window] of world.query(EvadeWindow)) {
		if (window.encounterId !== encounter.id) continue;
		entities.push(entity);
		gameBus.publish("EvadeResolved", {
			userId: window.targetUserId,
			result: {
				encounterId: window.encounterId,
				windowId: window.windowId,
				success: false,
				hit: false,
			},
		});
	}
	for (const entity of entities) world.delete(entity);
}

function tryPlayerAttack(world: World, handle: EncounterHandle, targetGuid: string, abilityId: string): boolean {
	if (world.get(handle.playerEntity, MainActionAvailable) !== true) return false;
	if (!(abilityId in ABILITY_DEFINITIONS)) return false;

	const ability = ABILITY_DEFINITIONS[abilityId as AbilityId];
	const target = findEntityByGuid(world, handle, targetGuid);
	if (target === undefined || target === handle.playerEntity) return false;
	if (world.get(target, CombatantType) !== "enemy") return false;

	const from = world.get(handle.playerEntity, WorldPos);
	const to = world.get(target, WorldPos);
	if (from === undefined || to === undefined) return false;
	if (horizontalDistance(from, to) > ability.range) return false;

	const stamina = world.get(handle.playerEntity, Stamina);
	if (stamina === undefined || stamina.current < ability.staminaCost) return false;
	if (ability.staminaCost > 0) {
		world.set(handle.playerEntity, Stamina, {
			current: stamina.current - ability.staminaCost,
			max: stamina.max,
		});
	}

	world.set(handle.playerEntity, MainActionAvailable, false);
	const attackerGuid = world.get(handle.playerEntity, Guid);
	const encounter = world.get(handle.encounterEntity, CombatEncounter);
	if (attackerGuid !== undefined && encounter !== undefined) {
		presentAnim(encounter.userId, encounter.id, attackerGuid, "attack", targetGuid);
	}
	pendingDamage.push({ target, amount: ability.damage });
	publishCombatantState(handle.playerEntity);
	return true;
}

/** Network callbacks hand off to ECS here, before any authoritative resolution. */
export function combatInputSystem(world: World): void {
	drainNetworkIntents();

	for (const queued of takeEvadeInputs()) {
		for (const [entity, window] of world.query(EvadeWindow).without(ResolvedEvade)) {
			if (
				window.targetUserId !== queued.player.UserId ||
				window.encounterId !== queued.input.encounterId ||
				window.windowId !== queued.input.windowId ||
				window.response !== undefined
			) {
				continue;
			}

			world.set(entity, EvadeWindow, {
				...window,
				response: {
					reaction: queued.input.reaction,
					clientPressTime: queued.input.clientPressTime,
					arrivedAt: queued.arrivedAt,
				},
			});
			break;
		}
	}
}

/** Owns round order, action availability, and enemy attack scheduling. */
export function turnResolveSystem(world: World): void {
	applyCompletedPlayerMoves(world);
	applyCompletedEnemyNav(world);

	for (const pending of pendingPlayers) createEncounter(world, pending);
	pendingPlayers.clear();

	const actions = takeCombatActions();
	for (const [encounterEntity, encounter] of world.query(CombatEncounter)) {
		const handle = encountersByUserId.get(encounter.userId);
		if (handle === undefined) continue;
		const playerHealth = world.get(handle.playerEntity, Health);
		const enemyHealth = world.get(handle.enemyEntity, Health);
		if (playerHealth?.current === 0 || enemyHealth?.current === 0) {
			if (encounter.phase !== "complete") {
				cancelEncounterWindows(world, encounter);
				setEncounter(world, encounterEntity, { ...encounter, phase: "complete" }, handle);
				const userId = encounter.userId;
				const enemyGuid = world.get(handle.enemyEntity, Guid);
				task.delay(1.25, () => destroyEncounterActors(userId, enemyGuid));
			}
			continue;
		}

		if (encounter.phase === "roundStart") {
			setEncounter(
				world,
				encounterEntity,
				{
					...encounter,
					order: sortInitiative(world, encounter.order),
					turnIndex: 0,
					phase: "actorTurn",
				},
				handle,
			);
			continue;
		}

		if (encounter.phase === "actorTurn") {
			startActorTurn(world, encounterEntity, encounter, handle);
			continue;
		}

		if (encounter.phase === "awaitingAction") {
			let dirty = false;
			for (const queued of actions) {
				if (queued.player.UserId !== encounter.userId) continue;

				if (queued.input.action === "move") {
					const destX = queued.input.destX;
					const destY = queued.input.destY;
					const destZ = queued.input.destZ;
					if (destX !== undefined && destY !== undefined && destZ !== undefined) {
						enqueuePlayerMove(world, handle, encounter, new Vector3(destX, destY, destZ));
					}
				} else if (queued.input.action === "attack") {
					const targetGuid = queued.input.targetGuid;
					const abilityId = queued.input.abilityId ?? "basicAttack";
					if (targetGuid !== undefined && tryPlayerAttack(world, handle, targetGuid, abilityId)) {
						dirty = true;
					}
				} else if (queued.input.action === "endTurn") {
					world.set(handle.playerEntity, MainActionAvailable, false);
					publishCombatantState(handle.playerEntity);
					advanceTurn(world, encounterEntity, encounter, handle);
					dirty = false;
					break;
				}
			}

			if (dirty) {
				publishEncounter(world, world.get(encounterEntity, CombatEncounter) ?? encounter, handle);
			}
			continue;
		}

		if (encounter.phase === "enemyAttack") {
			enqueueEnemyTurn(world, encounter, handle);
			continue;
		}

		if (encounter.phase === "resolvingEvade" && !encounterHasWindows(world, encounter.id)) {
			advanceTurn(world, encounterEntity, encounter, handle);
		}
	}
}

/** Judges reaction type and compensated timing on the authoritative server clock. */
export function evadeResolveSystem(world: World): void {
	const now = Workspace.GetServerTimeNow();
	for (const [entity, window] of world.query(EvadeWindow).without(ResolvedEvade)) {
		const response = window.response;
		if (response !== undefined) {
			const estimatedPressTime = response.arrivedAt - getNetworkLatency(window.targetUserId);
			const inWindow = estimatedPressTime >= window.openAt && estimatedPressTime <= window.closeAt;
			const success = inWindow && response.reaction === window.reaction;
			world.set(entity, ResolvedEvade, { success, hit: !success });
		} else if (now >= window.closeAt) {
			world.set(entity, ResolvedEvade, { success: false, hit: true });
		}
	}
}

/** Applies resolved outcomes and publishes state/network facts. */
export function combatEffectsSystem(world: World): void {
	const damagedUserIds = new Set<number>();

	for (const damage of pendingDamage) {
		const targetGuid = world.get(damage.target, Guid);
		applyDamage(world, damage.target, damage.amount);
		for (const [userId, handle] of encountersByUserId) {
			if (handle.playerEntity === damage.target || handle.enemyEntity === damage.target) {
				damagedUserIds.add(userId);
				const encounter = world.get(handle.encounterEntity, CombatEncounter);
				if (encounter !== undefined && targetGuid !== undefined) {
					presentAnim(userId, encounter.id, targetGuid, "hit");
				}
			}
		}
	}
	pendingDamage.clear();

	for (const [, window, resolution] of world.query(EvadeWindow, ResolvedEvade)) {
		if (resolution.hit) {
			applyDamage(world, window.target, window.damage);
			const targetGuid = world.get(window.target, Guid);
			if (targetGuid !== undefined) {
				presentAnim(window.targetUserId, window.encounterId, targetGuid, "hit");
			}
		}
		damagedUserIds.add(window.targetUserId);
		gameBus.publish("EvadeResolved", {
			userId: window.targetUserId,
			result: {
				encounterId: window.encounterId,
				windowId: window.windowId,
				success: resolution.success,
				hit: resolution.hit,
			},
		});
	}

	for (const userId of damagedUserIds) {
		const handle = encountersByUserId.get(userId);
		if (handle === undefined || !gameWorld.contains(handle.encounterEntity)) continue;
		const encounter = gameWorld.get(handle.encounterEntity, CombatEncounter);
		if (encounter !== undefined) publishEncounter(gameWorld, encounter, handle);
	}
}

/** Drops resolved timing entities after Effects consumed them. */
export function combatCleanupSystem(world: World): void {
	for (const [entity] of world.query(ResolvedEvade).with(EvadeWindow)) {
		world.delete(entity);
	}
}

export function startCombatSystems(): void {
	gameBus.subscribe("PlayerLoaded", ({ userId, combatantEntity }) => {
		pendingPlayers.push({ userId, combatantEntity });
	});

	gameBus.subscribe("EntityDespawned", ({ userId }) => {
		const handle = encountersByUserId.get(userId);
		if (handle === undefined) return;

		const encounter = gameWorld.get(handle.encounterEntity, CombatEncounter);
		if (encounter !== undefined) {
			for (const [windowEntity, window] of gameWorld.query(EvadeWindow)) {
				if (window.encounterId === encounter.id) gameWorld.delete(windowEntity);
			}
		}
		if (gameWorld.contains(handle.enemyEntity)) gameWorld.delete(handle.enemyEntity);
		if (gameWorld.contains(handle.encounterEntity)) gameWorld.delete(handle.encounterEntity);
		encountersByUserId.delete(userId);
		if (encounter !== undefined) {
			inFlightNav.delete(navKey(encounter.id, "player"));
			inFlightNav.delete(navKey(encounter.id, "enemy"));
		}
		destroyEncounterActors(userId);
	});
}
