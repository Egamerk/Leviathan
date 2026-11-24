import { CollectionService, RunService, ServerStorage, Workspace } from "@rbxts/services";
import { DetectionConfig } from "shared/config";
import { type EnemyDef, getEnemy } from "shared/data/enemies";
import { ServerNet } from "shared/net/server";
import { classifyEnemyEngage, suspicionRate } from "shared/rules/detection";
import type { EncounterKind } from "shared/rules/initiative";
import { deriveStats } from "shared/rules/stats";
import { guid } from "shared/util/guid";
import { ENEMY_FOLDER_NAME, findWorldPath } from "server/services/nav";
import { type DiverRecord, exploringDivers } from "server/services/players";
import { lightLevelAt } from "./lighting";

/**
 * Roaming (out-of-combat) enemy brains.
 *
 *   Idle/Patrol ──sees diver──► Suspicious ──meter full──► Pursuing ──in range──► Engage
 *        ▲                          │ meter drains              │ lost sight N s
 *        └──────────────────────────┴───────────────────────────┘
 *
 * One Heartbeat loop ticks every enemy at `TICK_RATE`; path requests run in
 * their own threads so a chunk bake never stalls the loop.
 *
 * Level design: place a part tagged `EnemySpawn` with a string attribute
 * `EnemyId` (e.g. "Drifter"). If `ServerStorage.Enemies.<EnemyId>` exists it is
 * cloned as the model; otherwise a placeholder capsule is generated.
 */

export const ENEMY_SPAWN_TAG = "EnemySpawn";
const TICK_RATE = 10;
const REPATH_INTERVAL = 0.5;

export type AwarenessState = "Idle" | "Suspicious" | "Pursuing";

export interface RoamingEnemy {
	id: string;
	def: EnemyDef;
	model: Model;
	humanoid: Humanoid;
	root: BasePart;
	home: Vector3;
	state: AwarenessState | "InCombat" | "Dead";
	suspicion: number;
	target?: DiverRecord;
	lastSeen: number;
	waypoints: Vector3[];
	waypointIndex: number;
	nextRepath: number;
	pathing: boolean;
	nextPatrol: number;
}

export interface EngageRequest {
	kind: EncounterKind;
	/** Combatant that triggered the fight (gets first turn on stealth/ambush). */
	initiator: { enemy: RoamingEnemy } | { diver: DiverRecord };
	enemy: RoamingEnemy;
	diver: DiverRecord;
}

const enemies = new Map<string, RoamingEnemy>();
let engageHandler: ((request: EngageRequest) => void) | undefined;

export function getRoamingEnemy(id: string): RoamingEnemy | undefined {
	return enemies.get(id);
}

export function roamingEnemiesNear(position: Vector3, radius: number): RoamingEnemy[] {
	const out = new Array<RoamingEnemy>();
	for (const [, enemy] of enemies) {
		if (enemy.state === "InCombat" || enemy.state === "Dead") continue;
		if (enemy.root.Position.sub(position).Magnitude <= radius) out.push(enemy);
	}
	return out;
}

export function setEnemyInCombat(enemy: RoamingEnemy, inCombat: boolean) {
	enemy.state = inCombat ? "InCombat" : "Idle";
	enemy.suspicion = 0;
	enemy.target = undefined;
	enemy.waypoints = [];
	enemy.root.Anchored = inCombat;
	if (inCombat) enemy.humanoid.Move(Vector3.zero);
}

export function killEnemy(enemy: RoamingEnemy) {
	enemy.state = "Dead";
	enemies.delete(enemy.id);
	enemy.model.Destroy();
}

// ── Spawning ────────────────────────────────────────────────────────────────

function folder(): Folder {
	let f = Workspace.FindFirstChild(ENEMY_FOLDER_NAME) as Folder | undefined;
	if (f === undefined) {
		f = new Instance("Folder");
		f.Name = ENEMY_FOLDER_NAME;
		f.Parent = Workspace;
	}
	return f;
}

function placeholderModel(def: EnemyDef): Model {
	const model = new Instance("Model");
	const root = new Instance("Part");
	root.Name = "HumanoidRootPart";
	root.Size = new Vector3(2, 2, 1);
	root.Transparency = 1;
	root.Parent = model;

	const body = new Instance("Part");
	body.Name = "Body";
	body.Shape = Enum.PartType.Cylinder;
	body.Size = new Vector3(4.5, 2.5, 2.5);
	body.CFrame = root.CFrame.mul(CFrame.Angles(0, 0, math.pi / 2)).add(new Vector3(0, -0.25, 0));
	body.Color = def.id === "Drifter" ? Color3.fromRGB(70, 110, 140) : Color3.fromRGB(140, 60, 60);
	body.Massless = true;
	body.CanCollide = false;
	body.Parent = model;
	const weld = new Instance("WeldConstraint");
	weld.Part0 = root;
	weld.Part1 = body;
	weld.Parent = body;

	const humanoid = new Instance("Humanoid");
	humanoid.HipHeight = 2;
	humanoid.Parent = model;
	model.PrimaryPart = root;
	return model;
}

export function spawnEnemy(enemyId: string, position: Vector3): RoamingEnemy | undefined {
	const def = getEnemy(enemyId);
	if (def === undefined) {
		warn(`[enemies] Unknown EnemyId "${enemyId}"`);
		return undefined;
	}
	const template = ServerStorage.FindFirstChild("Enemies")?.FindFirstChild(enemyId);
	const model = template?.IsA("Model") ? template.Clone() : placeholderModel(def);
	const humanoid = model.FindFirstChildOfClass("Humanoid");
	const root = model.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
	if (humanoid === undefined || root === undefined) {
		warn(`[enemies] ${enemyId} model needs a Humanoid and HumanoidRootPart`);
		return undefined;
	}

	const id = guid();
	model.Name = `${def.name}`;
	model.SetAttribute("EnemyId", id);
	model.PivotTo(new CFrame(position.add(new Vector3(0, 3, 0))));
	model.Parent = folder();
	humanoid.WalkSpeed = def.roam.walkSpeed;
	humanoid.MaxHealth = deriveStats(def.stats).maxHealth;
	root.SetNetworkOwner(undefined); // server-owned physics so pursuit can't be spoofed

	const enemy: RoamingEnemy = {
		id,
		def,
		model,
		humanoid,
		root,
		home: position,
		state: "Idle",
		suspicion: 0,
		lastSeen: 0,
		waypoints: [],
		waypointIndex: 0,
		nextRepath: 0,
		pathing: false,
		nextPatrol: os.clock() + math.random() * 4,
	};
	enemies.set(id, enemy);
	return enemy;
}

// ── Perception ──────────────────────────────────────────────────────────────

const sightParams = new RaycastParams();
sightParams.FilterType = Enum.RaycastFilterType.Exclude;

function canSee(enemy: RoamingEnemy, character: Model, targetRoot: BasePart): boolean {
	const eye = enemy.root.Position.add(new Vector3(0, 1.5, 0));
	sightParams.FilterDescendantsInstances = [folder()];
	const hit = Workspace.Raycast(eye, targetRoot.Position.sub(eye), sightParams);
	return hit === undefined || hit.Instance.IsDescendantOf(character);
}

function perceive(enemy: RoamingEnemy, dt: number) {
	let bestRate = 0;
	let bestDiver: DiverRecord | undefined;

	for (const diver of exploringDivers()) {
		const character = diver.player.Character!;
		const root = character.FindFirstChild("HumanoidRootPart") as BasePart;
		const offset = root.Position.sub(enemy.root.Position);
		if (offset.Magnitude > DetectionConfig.sightRange) continue;

		const rate = suspicionRate({
			offset,
			look: enemy.root.CFrame.LookVector,
			hasLineOfSight: canSee(enemy, character, root),
			crouching: diver.crouching,
			stealth: deriveStats(diver.stats).stealth,
			light: lightLevelAt(root.Position),
		});
		if (rate > bestRate) {
			bestRate = rate;
			bestDiver = diver;
		}
	}

	if (bestDiver !== undefined) {
		enemy.suspicion = math.min(enemy.suspicion + bestRate * dt, DetectionConfig.pursueThreshold * 1.5);
		enemy.lastSeen = os.clock();
		enemy.target = bestDiver;
	} else {
		enemy.suspicion = math.max(enemy.suspicion - DetectionConfig.suspicionDecayPerSecond * dt, 0);
	}
}

// ── Movement ────────────────────────────────────────────────────────────────

function requestPath(enemy: RoamingEnemy, destination: Vector3) {
	if (enemy.pathing) return;
	enemy.pathing = true;
	task.spawn(() => {
		const path = findWorldPath(enemy.root.Position, destination);
		enemy.pathing = false;
		if (enemy.state === "InCombat" || enemy.state === "Dead") return;
		enemy.waypoints = path ?? [];
		enemy.waypointIndex = 1;
	});
}

function followPath(enemy: RoamingEnemy) {
	const waypoint = enemy.waypoints[enemy.waypointIndex];
	if (waypoint === undefined) return;
	const flat = new Vector3(waypoint.X - enemy.root.Position.X, 0, waypoint.Z - enemy.root.Position.Z);
	if (flat.Magnitude < 2) {
		enemy.waypointIndex += 1;
		return;
	}
	enemy.humanoid.MoveTo(waypoint.add(new Vector3(0, enemy.humanoid.HipHeight, 0)));
}

// ── Brain ───────────────────────────────────────────────────────────────────

function tick(enemy: RoamingEnemy, dt: number) {
	if (enemy.state === "InCombat" || enemy.state === "Dead") return;
	perceive(enemy, dt);
	const now = os.clock();
	const previous = enemy.state;

	if (enemy.state === "Pursuing") {
		const lost = now - enemy.lastSeen > DetectionConfig.loseTrackSeconds;
		const targetRoot = enemy.target?.player.Character?.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
		if (lost || targetRoot === undefined || enemy.target!.phase !== "Explore") {
			enemy.state = "Idle";
			enemy.suspicion = 0;
			enemy.humanoid.WalkSpeed = enemy.def.roam.walkSpeed;
			requestPath(enemy, enemy.home);
		} else {
			const distance = targetRoot.Position.sub(enemy.root.Position).Magnitude;
			if (distance <= DetectionConfig.engageRange) {
				engage(enemy, enemy.target!, targetRoot);
				return;
			}
			if (now >= enemy.nextRepath) {
				enemy.nextRepath = now + REPATH_INTERVAL;
				requestPath(enemy, targetRoot.Position);
			}
		}
	} else if (enemy.suspicion >= DetectionConfig.pursueThreshold) {
		enemy.state = "Pursuing";
		enemy.humanoid.WalkSpeed = enemy.def.roam.pursueSpeed;
		enemy.nextRepath = 0;
	} else if (enemy.suspicion > 0) {
		enemy.state = "Suspicious";
		enemy.waypoints = [];
		// Turn to look at the noise.
		const targetRoot = enemy.target?.player.Character?.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
		if (targetRoot)
			enemy.humanoid.MoveTo(enemy.root.Position.add(targetRoot.Position.sub(enemy.root.Position).Unit));
	} else {
		enemy.state = "Idle";
		if (now >= enemy.nextPatrol && !enemy.pathing) {
			enemy.nextPatrol = now + 4 + math.random() * 6;
			const r = enemy.def.roam.patrolRadius;
			requestPath(enemy, enemy.home.add(new Vector3(math.random(-r, r), 0, math.random(-r, r))));
		}
	}

	followPath(enemy);

	if (enemy.state !== previous || enemy.state === "Suspicious") {
		if (enemy.target) {
			ServerNet.awareness.fire(enemy.target.player, {
				enemyId: enemy.id,
				suspicion: enemy.suspicion,
				state: enemy.state as AwarenessState,
			});
		}
	}
}

function engage(enemy: RoamingEnemy, diver: DiverRecord, diverRoot: BasePart) {
	const kind = classifyEnemyEngage(
		diverRoot.CFrame.LookVector,
		enemy.root.Position.sub(diverRoot.Position),
		lightLevelAt(diverRoot.Position),
	);
	engageHandler?.({ kind, initiator: { enemy }, enemy, diver });
}

export function startEnemyService(onEngage: (request: EngageRequest) => void) {
	engageHandler = onEngage;

	const spawnFrom = (instance: Instance) => {
		if (!instance.IsA("BasePart")) return;
		const enemyId = instance.GetAttribute("EnemyId");
		if (typeIs(enemyId, "string")) spawnEnemy(enemyId, instance.Position);
	};
	for (const spawner of CollectionService.GetTagged(ENEMY_SPAWN_TAG)) spawnFrom(spawner);
	CollectionService.GetInstanceAddedSignal(ENEMY_SPAWN_TAG).Connect(spawnFrom);

	// Diver-initiated stealth engagement (Trello: Stealth/Assassination Encounters [Diver]).
	ServerNet.engageEnemy.setCallback((player, { enemyId }) => {
		const enemy = enemies.get(enemyId);
		const diver = exploringDivers().find((d) => d.player === player);
		const root = player.Character?.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
		if (enemy === undefined || diver === undefined || root === undefined) return;
		if (enemy.state === "InCombat" || enemy.state === "Dead") return;
		if (root.Position.sub(enemy.root.Position).Magnitude > DetectionConfig.engageRange + 2) return;
		const unaware = enemy.state === "Idle";
		engageHandler?.({ kind: unaware ? "DiverStealth" : "HeadOn", initiator: { diver }, enemy, diver });
	});

	let accumulator = 0;
	RunService.Heartbeat.Connect((dt) => {
		accumulator += dt;
		if (accumulator < 1 / TICK_RATE) return;
		const step = accumulator;
		accumulator = 0;
		for (const [, enemy] of enemies) tick(enemy, step);
	});
}
