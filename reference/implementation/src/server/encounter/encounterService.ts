import { TweenService } from "@rbxts/services";
import { nextAiCommand } from "shared/combat/ai";
import { CombatEngine } from "shared/combat/engine";
import type { Combatant, CombatCommand, CombatEvent } from "shared/combat/types";
import { CombatConfig, DetectionConfig } from "shared/config";
import { getAbility, type Limb } from "shared/data/abilities";
import type { NodeId, VoxelGrid } from "shared/nav/grid";
import { captureArena, restoreArena } from "shared/nav/snapshot";
import { ServerNet } from "shared/net/server";
import type * as Zap from "shared/net/zapServer";
import type { EncounterKind } from "shared/rules/initiative";
import { deriveStats } from "shared/rules/stats";
import { now } from "shared/util/clock";
import { guid } from "shared/util/guid";
import {
	type EngageRequest,
	killEnemy,
	type RoamingEnemy,
	roamingEnemiesNear,
	setEnemyInCombat,
} from "server/ai/enemyService";
import { ensureBaked, worldGrid } from "server/services/nav";
import { type DiverRecord, exploringDivers, getDiver } from "server/services/players";

/**
 * Bridges the open world and the pure `CombatEngine`.
 *
 *  start():   gather participants → bake + snapshot the arena → snap everyone
 *             onto grid tiles → anchor models → build engine → broadcast.
 *  run loop:  client commands / AI decisions / QTE results → engine.apply →
 *             replicate events → animate → open QTE windows → repeat.
 *  finish():  write resources back, release models, resume roaming.
 */

interface QteWindow {
	id: number;
	kind: "Attack" | "Defense";
	player: Player;
	combatantId: string;
	impactAt: number;
	parryOpensAt: number;
	dodgeOpensAt: number;
	closesAt: number;
	resolved: boolean;
}

interface Encounter {
	id: string;
	engine: CombatEngine;
	grid: VoxelGrid;
	divers: Map<string, DiverRecord>;
	enemies: Map<string, RoamingEnemy>;
	models: Map<string, Model>;
	window?: QteWindow;
	/** Bumped every time the acting turn changes; stale timers compare against it. */
	turnToken: number;
	busy: boolean;
	ended: boolean;
}

const encounters = new Map<string, Encounter>();
let windowCounter = 0;

const ATTACK_WINDOW = 0.3; // Trello: target-hit frames are after impact, not before
const PARRY_WINDOW = 0.4;
const BASE_DODGE_WINDOW = 0.22; // Trello: dodge frames are tighter than parry frames
const DODGE_PER_DEXTERITY = 0.02;
const AI_STEP_DELAY = 0.6;
const STEP_TWEEN_TIME = 0.12;
const DOWN_PLACEHOLDER_SECONDS = 15;

// ── Participants ────────────────────────────────────────────────────────────

function rootOf(model: Model | undefined): BasePart | undefined {
	return model?.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
}

function diverCombatant(record: DiverRecord, node: NodeId): Combatant {
	const derived = deriveStats(record.stats);
	return {
		id: `diver:${record.player.UserId}`,
		name: record.player.DisplayName,
		side: "diver",
		control: "player",
		userId: record.player.UserId,
		defId: "Diver",
		stats: record.stats,
		derived,
		defense: 0,
		canParry: true,
		canDodge: true,
		health: { current: record.health, max: derived.maxHealth },
		stamina: { current: record.stamina, max: derived.maxStamina },
		reservoir: derived.hasReservoir ? { current: record.reservoir, max: derived.maxReservoir } : undefined,
		auxiliary: { current: record.auxiliary, max: derived.maxAuxiliary },
		node,
		abilities: [...record.abilities],
		statuses: [],
		condition: "active",
		staggered: false,
	};
}

function enemyCombatant(enemy: RoamingEnemy, node: NodeId): Combatant {
	const def = enemy.def;
	const derived = deriveStats(def.stats, { armorHealth: def.maxHealth, speedStuds: def.speedStuds });
	return {
		id: `enemy:${enemy.id}`,
		name: def.name,
		side: "enemy",
		control: "ai",
		defId: def.id,
		stats: def.stats,
		derived: { ...derived, maxHealth: def.maxHealth },
		defense: def.defense,
		canParry: def.canParry,
		canDodge: def.canDodge,
		health: { current: def.maxHealth, max: def.maxHealth },
		stamina: { current: derived.maxStamina, max: derived.maxStamina },
		auxiliary: { current: 0, max: 0 },
		node,
		abilities: [...def.abilities],
		statuses: [],
		condition: "active",
		staggered: false,
	};
}

function toView(c: Combatant, model: Model | undefined): Zap.CombatantView {
	return {
		id: c.id,
		name: c.name,
		side: c.side,
		control: c.control,
		userId: c.userId,
		defId: c.defId,
		node: c.node,
		health: c.health,
		stamina: c.stamina,
		reservoir: c.reservoir,
		auxiliary: c.auxiliary,
		moveStuds: c.derived.moveStuds,
		abilities: c.abilities,
		model,
	};
}

// ── Start ───────────────────────────────────────────────────────────────────

export function isInEncounter(player: Player): boolean {
	return getDiver(player)?.encounterId !== undefined;
}

/** Entry point from the roaming layer (enemy reached a diver, or a diver struck first). */
export function startEncounter(request: EngageRequest) {
	const triggerRoot = rootOf(request.diver.player.Character);
	if (triggerRoot === undefined || request.diver.phase !== "Explore") return;
	const center = triggerRoot.Position.add(request.enemy.root.Position).div(2);

	// Everyone nearby who is free joins (Trello: party fights together).
	const divers = exploringDivers().filter((d) => {
		const root = rootOf(d.player.Character);
		return root !== undefined && root.Position.sub(center).Magnitude <= DetectionConfig.encounterJoinRadius;
	});
	const enemies = roamingEnemiesNear(center, DetectionConfig.encounterJoinRadius * 0.6);
	if (!enemies.includes(request.enemy)) enemies.push(request.enemy);

	// Lock participants immediately so nothing else can grab them while we bake.
	for (const d of divers) d.phase = "Combat";
	for (const e of enemies) setEnemyInCombat(e, true);
	for (const d of divers) {
		const root = rootOf(d.player.Character);
		if (root) root.Anchored = true;
	}

	task.spawn(() => buildEncounter(request.kind, request, center, divers, enemies));
}

function buildEncounter(
	kind: EncounterKind,
	request: EngageRequest,
	center: Vector3,
	divers: DiverRecord[],
	enemies: RoamingEnemy[],
) {
	const radius = CombatConfig.arenaRadius;
	ensureBaked(center, radius + 8);

	// The server fights on the *restored* snapshot so its numbers match the client's bit for bit.
	const snapshot = captureArena(worldGrid, center, radius);
	const grid = restoreArena(snapshot);

	const combatants = new Array<Combatant>();
	const models = new Map<string, Model>();
	const diverMap = new Map<string, DiverRecord>();
	const enemyMap = new Map<string, RoamingEnemy>();

	const place = (model: Model | undefined): NodeId | undefined => {
		const root = rootOf(model);
		if (root === undefined) return undefined;
		const node = grid.nearestNode(root.Position, 10);
		if (node !== undefined) grid.block(node);
		return node;
	};

	for (const record of divers) {
		const node = place(record.player.Character);
		if (node === undefined) continue;
		const c = diverCombatant(record, node);
		combatants.push(c);
		diverMap.set(c.id, record);
		models.set(c.id, record.player.Character!);
	}
	for (const enemy of enemies) {
		const node = place(enemy.model);
		if (node === undefined) continue;
		const c = enemyCombatant(enemy, node);
		combatants.push(c);
		enemyMap.set(c.id, enemy);
		models.set(c.id, enemy.model);
	}

	if (diverMap.size() === 0 || enemyMap.size() === 0) {
		warn("[encounter] Not enough walkable space to start an encounter here");
		for (const d of divers) release(d);
		for (const e of enemies) setEnemyInCombat(e, false);
		return;
	}

	const initiatorId =
		"enemy" in request.initiator
			? `enemy:${request.initiator.enemy.id}`
			: `diver:${request.initiator.diver.player.UserId}`;

	const id = guid();
	const engine = new CombatEngine(id, kind, combatants, grid, new Random(), initiatorId);
	const encounter: Encounter = {
		id,
		engine,
		grid,
		divers: diverMap,
		enemies: enemyMap,
		models,
		turnToken: 0,
		busy: false,
		ended: false,
	};
	encounters.set(id, encounter);
	for (const [, record] of diverMap) record.encounterId = id;

	// Snap every model onto its tile, facing the arena centre.
	for (const c of combatants) snapModel(encounter, c.id, c.node, center);

	const views = combatants.map((c) => toView(c, models.get(c.id)));
	for (const [, record] of diverMap) {
		ServerNet.encounterStarted.fire(record.player, {
			encounterId: id,
			kind,
			center,
			arena: snapshot,
			combatants: views,
		});
	}

	process(encounter, engine.start());
}

// ── Event processing ────────────────────────────────────────────────────────

function players(encounter: Encounter): Player[] {
	const out = new Array<Player>();
	for (const [, record] of encounter.divers) if (record.player.Parent !== undefined) out.push(record.player);
	return out;
}

/**
 * Replicates a batch of events, plays the server-side parts (model movement),
 * opens QTE windows and schedules whoever acts next. Runs in its own thread
 * because animations yield.
 */
function process(encounter: Encounter, events: CombatEvent[]) {
	if (events.size() === 0) return;
	ServerNet.combatEvents.fireList(players(encounter), { encounterId: encounter.id, events });

	encounter.busy = true;
	task.spawn(() => {
		for (const event of events) {
			if (event.type === "Moved") animateMove(encounter, event.actorId, event.path);
			else if (event.type === "AwaitAttackQte")
				openAttackWindow(encounter, event.actorId, event.abilityId, event.qte);
			else if (event.type === "AwaitDefense") openDefenseWindow(encounter, event);
			else if (event.type === "EncounterEnded") {
				encounter.busy = false;
				finish(encounter, event.winner);
				return;
			}
		}
		encounter.busy = false;
		scheduleNext(encounter);
	});
}

function apply(encounter: Encounter, command: CombatCommand): boolean {
	if (encounter.ended) return false;
	const result = encounter.engine.apply(command);
	if (!result.ok) return false;
	process(encounter, result.events);
	return true;
}

/** After events finish playing: drive the AI or arm the player's turn timer. */
function scheduleNext(encounter: Encounter) {
	const engine = encounter.engine;
	if (encounter.ended || engine.state.pending !== undefined) return;
	encounter.turnToken += 1;
	const token = encounter.turnToken;
	const actor = engine.currentActor();

	if (actor.control === "ai") {
		task.delay(AI_STEP_DELAY, () => {
			if (encounter.ended || encounter.turnToken !== token || encounter.busy) return;
			const command = nextAiCommand(engine);
			if (!apply(encounter, command)) apply(encounter, { type: "EndTurn", actorId: actor.id });
		});
	} else {
		task.delay(CombatConfig.turnTimeout, () => {
			if (encounter.ended || encounter.turnToken !== token) return;
			apply(encounter, { type: "EndTurn", actorId: actor.id });
		});
	}
}

// ── Model presentation (server-side, replicated) ────────────────────────────

function snapModel(encounter: Encounter, combatantId: string, node: NodeId, lookAt: Vector3) {
	const model = encounter.models.get(combatantId);
	const root = rootOf(model);
	if (model === undefined || root === undefined) return;
	root.Anchored = true;
	const humanoid = model.FindFirstChildOfClass("Humanoid");
	const height = (humanoid?.HipHeight ?? 2) + root.Size.Y / 2;
	const position = encounter.grid.nodePosition(node).add(new Vector3(0, height, 0));
	const flatLook = new Vector3(lookAt.X, position.Y, lookAt.Z);
	root.CFrame = flatLook.sub(position).Magnitude > 0.1 ? CFrame.lookAt(position, flatLook) : new CFrame(position);
}

function animateMove(encounter: Encounter, combatantId: string, path: NodeId[]) {
	const root = rootOf(encounter.models.get(combatantId));
	if (root === undefined) return;
	const humanoid = encounter.models.get(combatantId)!.FindFirstChildOfClass("Humanoid");
	const height = (humanoid?.HipHeight ?? 2) + root.Size.Y / 2;
	for (let i = 1; i < path.size(); i++) {
		const position = encounter.grid.nodePosition(path[i]).add(new Vector3(0, height, 0));
		const look = new Vector3(position.X, position.Y, position.Z).sub(root.Position);
		const goal =
			look.Magnitude > 0.05
				? CFrame.lookAt(position, position.add(new Vector3(look.X, 0, look.Z)))
				: new CFrame(position);
		const tween = TweenService.Create(root, new TweenInfo(STEP_TWEEN_TIME, Enum.EasingStyle.Linear), {
			CFrame: goal,
		});
		tween.Play();
		tween.Completed.Wait();
	}
}

// ── Quick Time Events ───────────────────────────────────────────────────────

function playerFor(encounter: Encounter, combatantId: string): Player | undefined {
	return encounter.divers.get(combatantId)?.player;
}

function openAttackWindow(encounter: Encounter, attackerId: string, abilityId: string, qte: string) {
	const player = playerFor(encounter, attackerId);
	const ability = getAbility(abilityId)!;
	const impactAt = now() + ability.windup;
	const window: QteWindow = {
		id: ++windowCounter,
		kind: "Attack",
		player: player!,
		combatantId: attackerId,
		impactAt,
		parryOpensAt: impactAt,
		dodgeOpensAt: impactAt,
		closesAt: impactAt + ATTACK_WINDOW,
		resolved: false,
	};
	encounter.window = window;
	if (player) {
		ServerNet.qteWindow.fire(player, {
			windowId: window.id,
			kind: "Attack",
			qte,
			abilityId,
			opensAt: impactAt,
			closesAt: window.closesAt,
			canParry: false,
			canDodge: false,
		});
	}
	armTimeout(encounter, window);
}

function openDefenseWindow(encounter: Encounter, event: Extract<CombatEvent, { type: "AwaitDefense" }>) {
	const player = playerFor(encounter, event.targetId);
	const target = encounter.engine.get(event.targetId)!;
	const ability = getAbility(event.abilityId)!;
	const impactAt = now() + ability.windup;
	const dodgeWindow = BASE_DODGE_WINDOW + target.stats.dexterity * DODGE_PER_DEXTERITY;
	const window: QteWindow = {
		id: ++windowCounter,
		kind: "Defense",
		player: player!,
		combatantId: event.targetId,
		impactAt,
		parryOpensAt: impactAt - PARRY_WINDOW,
		dodgeOpensAt: impactAt - dodgeWindow,
		closesAt: impactAt + 0.05,
		resolved: false,
	};
	encounter.window = window;
	if (player) {
		ServerNet.qteWindow.fire(player, {
			windowId: window.id,
			kind: "Defense",
			qte: "Defense",
			abilityId: event.abilityId,
			opensAt: math.min(window.parryOpensAt, window.dodgeOpensAt),
			closesAt: window.closesAt,
			canParry: event.canParry,
			canDodge: event.canDodge,
		});
	}
	armTimeout(encounter, window);
}

/** No input before the window closes = failed QTE. */
function armTimeout(encounter: Encounter, window: QteWindow) {
	const wait = window.closesAt + CombatConfig.qteLatencyGrace - now();
	task.delay(math.max(wait, 0), () => {
		if (window.resolved || encounter.window !== window) return;
		resolveWindow(encounter, window, undefined);
	});
}

type QteInput = Parameters<Parameters<typeof ServerNet.qteInput.setCallback>[0]>[1];

function resolveWindow(encounter: Encounter, window: QteWindow, input: QteInput | undefined) {
	window.resolved = true;
	encounter.window = undefined;
	const grace = CombatConfig.qteLatencyGrace;
	// Clamp the client's claimed press time to what the server could have received.
	const pressedAt = input === undefined ? math.huge : math.min(input.pressedAt, now());
	const inside = (opensAt: number) => pressedAt >= opensAt - grace && pressedAt <= window.closesAt + grace;

	if (window.kind === "Attack") {
		const hit = input !== undefined && input.input.type === "Hit" && inside(window.parryOpensAt);
		const limb: Limb = input !== undefined && input.input.type === "Hit" ? input.input.limb : "Torso";
		apply(encounter, { type: "ResolveAttackQte", actorId: window.combatantId, success: hit, limb });
		return;
	}

	let command: CombatCommand = { type: "ResolveDefense", targetId: window.combatantId, reaction: "None" };
	if (input?.input.type === "Parry" && inside(window.parryOpensAt)) {
		command = { type: "ResolveDefense", targetId: window.combatantId, reaction: "Parry" };
	} else if (input?.input.type === "Dodge" && inside(window.dodgeOpensAt)) {
		command = {
			type: "ResolveDefense",
			targetId: window.combatantId,
			reaction: "Dodge",
			direction: input.input.direction,
		};
	}
	apply(encounter, command);
}

// ── Finish ──────────────────────────────────────────────────────────────────

function release(record: DiverRecord) {
	record.encounterId = undefined;
	if (record.phase === "Combat") record.phase = "Explore";
	const root = rootOf(record.player.Character);
	if (root) root.Anchored = false;
}

function finish(encounter: Encounter, winner: "diver" | "enemy") {
	if (encounter.ended) return;
	encounter.ended = true;
	encounters.delete(encounter.id);
	ServerNet.encounterEnded.fireList(players(encounter), { encounterId: encounter.id, winner });

	for (const [id, record] of encounter.divers) {
		const c = encounter.engine.get(id)!;
		record.health = c.health.current;
		record.stamina = c.stamina.current;
		record.reservoir = c.reservoir?.current ?? record.reservoir;
		// Trello: Energy Types — ending a battle grants +1 Auxiliary.
		record.auxiliary = math.min(c.auxiliary.max, c.auxiliary.current + 1);
		release(record);
		// Trello: Health — unconscious divers stay down outside combat until revived.
		if (c.condition !== "active") {
			record.phase = "Down";
			// PLACEHOLDER until Vials/Rituals/extraction exist: wake up at 40% after a while.
			task.delay(DOWN_PLACEHOLDER_SECONDS, () => {
				if (record.phase !== "Down") return;
				record.phase = "Explore";
				record.health = deriveStats(record.stats).maxHealth * 0.4;
			});
		}
	}
	for (const [id, enemy] of encounter.enemies) {
		const c = encounter.engine.get(id)!;
		if (c.condition !== "active") killEnemy(enemy);
		else setEnemyInCombat(enemy, false);
	}
}

// ── Wiring ──────────────────────────────────────────────────────────────────

function encounterOf(player: Player): Encounter | undefined {
	const id = getDiver(player)?.encounterId;
	return id !== undefined ? encounters.get(id) : undefined;
}

export function onDiverLeaving(record: DiverRecord) {
	const id = record.encounterId;
	const encounter = id !== undefined ? encounters.get(id) : undefined;
	if (encounter === undefined) return;
	const combatantId = `diver:${record.player.UserId}`;
	encounter.divers.delete(combatantId);
	process(encounter, encounter.engine.forfeit(combatantId));
}

export function startEncounterService() {
	ServerNet.combatCommand.setCallback((player, command) => {
		const encounter = encounterOf(player);
		if (encounter === undefined || encounter.busy) return;
		const actorId = `diver:${player.UserId}`;
		switch (command.type) {
			case "Move":
				apply(encounter, { type: "Move", actorId, to: command.to });
				break;
			case "UseAbility":
				apply(encounter, {
					type: "UseAbility",
					actorId,
					abilityId: command.abilityId,
					targetId: command.targetId,
				});
				break;
			case "Recover":
				apply(encounter, { type: "Recover", actorId });
				break;
			case "EndTurn":
				apply(encounter, { type: "EndTurn", actorId });
				break;
		}
	});

	ServerNet.qteInput.setCallback((player, input) => {
		const encounter = encounterOf(player);
		const window = encounter?.window;
		if (encounter === undefined || window === undefined) return;
		if (window.id !== input.windowId || window.player !== player || window.resolved) return;
		resolveWindow(encounter, window, input);
	});
}
