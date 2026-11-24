import ProfileStore from "@rbxts/profile-store";
import { Players, RunService } from "@rbxts/services";
import type { Entity } from "@rbxts/jecs";
import type { CombatantState, EntitySave, ProfileTemplate, ResourceState } from "shared/ecs/types";
import {
	Combatant,
	CombatantType,
	BASE_INITIATIVE,
	DEFAULT_MOVEMENT_POINTS,
	Guid,
	Health,
	Initiative,
	MAX_HEALTH,
	MAX_STAMINA,
	MovementPoints,
	Name,
	OwnerUserId,
	Persistent,
	Player,
	Stamina,
	UserId,
	calculateInitiative,
} from "shared/ecs/components";
import { gameBus } from "shared/ecs/bus";
import { world } from "shared/ecs/world";
import { createGuid } from "shared/util";

const PROFILE_TEMPLATE: ProfileTemplate = {
	version: 3,
	entities: {},
	regions: {},
};

const playerStore = ProfileStore.New("PlayerData", PROFILE_TEMPLATE);
const dataStore = RunService.IsStudio() ? playerStore.Mock : playerStore;

export interface PlayerSession {
	player: Player;
	profile: ProfileStore.Profile<ProfileTemplate>;
	playerEntity: Entity;
	combatantEntity: Entity;
	combatantGuid: string;
}

const sessions = new Map<number, PlayerSession>();
const entitiesByGuid = new Map<string, Entity>();
/** UserIds whose EndSession we initiated (avoid Kick on intentional unload/reload). */
const intentionalSessionEnds = new Set<number>();

export function getProfile(player: Player): ProfileStore.Profile<ProfileTemplate> | undefined {
	return sessions.get(player.UserId)?.profile;
}

export function getSession(userId: number): PlayerSession | undefined {
	return sessions.get(userId);
}

export function getEntityByGuid(guid: string): Entity | undefined {
	return entitiesByGuid.get(guid);
}

function clampResource(resource: ResourceState | undefined, fallbackMax: number): ResourceState {
	const max = resource?.max ?? fallbackMax;
	const current = math.clamp(resource?.current ?? max, 0, max);
	return { current, max };
}

function resolveCombatantState(guid: string, components: EntitySave["components"]): CombatantState {
	const health = clampResource(components.health, MAX_HEALTH);
	// Stub: no death/downed loop yet — never boot a session already at 0 HP.
	const playableHealth = { current: math.max(1, health.current), max: health.max };
	const stamina = clampResource(components.stamina, MAX_STAMINA);
	return {
		guid,
		health: playableHealth,
		stamina,
		initiative: components.initiative ?? calculateInitiative(playableHealth),
		movementPoints: components.movementPoints ?? DEFAULT_MOVEMENT_POINTS,
	};
}

function getOrCreateCombatant(profile: ProfileStore.Profile<ProfileTemplate>): EntitySave {
	for (const [, saved] of pairs(profile.Data.entities)) {
		if (saved.kind === "combatant") return saved;
	}

	const guid = createGuid();
	const combatant: EntitySave = {
		guid,
		kind: "combatant",
		components: {
			health: { current: MAX_HEALTH, max: MAX_HEALTH },
			stamina: { current: MAX_STAMINA, max: MAX_STAMINA },
			initiative: BASE_INITIATIVE,
			movementPoints: DEFAULT_MOVEMENT_POINTS,
		},
	};
	profile.Data.entities[guid] = combatant;
	return combatant;
}

function destroySession(userId: number): void {
	const session = sessions.get(userId);
	if (session === undefined) return;

	gameBus.publish("EntityDespawned", {
		userId,
		guid: session.combatantGuid,
	});

	entitiesByGuid.delete(session.combatantGuid);
	if (world.contains(session.combatantEntity)) world.delete(session.combatantEntity);
	if (world.contains(session.playerEntity)) world.delete(session.playerEntity);
	sessions.delete(userId);
}

export function loadPlayer(player: Player): void {
	const profile = dataStore.StartSessionAsync(`Player_${player.UserId}`, {
		Cancel: () => player.Parent !== Players,
	}) as ProfileStore.Profile<ProfileTemplate> | undefined;

	if (profile === undefined) {
		player.Kick("Failed to load data. Please rejoin.");
		return;
	}

	profile.AddUserId(player.UserId);
	profile.Reconcile();

	profile.OnSessionEnd.Connect(() => {
		destroySession(player.UserId);
		if (player.Parent === Players && !intentionalSessionEnds.has(player.UserId)) {
			player.Kick("Your data session ended. Please rejoin.");
		}
	});

	if (player.Parent !== Players) {
		profile.EndSession();
		return;
	}

	const combatantSave = getOrCreateCombatant(profile);
	const state = resolveCombatantState(combatantSave.guid, combatantSave.components);
	combatantSave.components.health = state.health;
	combatantSave.components.stamina = state.stamina;
	combatantSave.components.initiative = state.initiative;
	combatantSave.components.movementPoints = state.movementPoints;

	const playerEntity = world.entity();
	world.add(playerEntity, Player);
	world.set(playerEntity, UserId, player.UserId);
	world.set(playerEntity, Name, player.Name);

	const combatantEntity = world.entity();
	world.add(combatantEntity, Combatant);
	world.add(combatantEntity, Persistent);
	world.set(combatantEntity, CombatantType, "player");
	world.set(combatantEntity, Guid, combatantSave.guid);
	world.set(combatantEntity, OwnerUserId, player.UserId);
	world.set(combatantEntity, Health, state.health);
	world.set(combatantEntity, Stamina, state.stamina);
	world.set(combatantEntity, Initiative, state.initiative);
	world.set(combatantEntity, MovementPoints, state.movementPoints);

	const session: PlayerSession = {
		player,
		profile,
		playerEntity,
		combatantEntity,
		combatantGuid: combatantSave.guid,
	};
	sessions.set(player.UserId, session);
	entitiesByGuid.set(combatantSave.guid, combatantEntity);

	print(
		`[persist] load UserId=${player.UserId} name=${player.Name} HP ${state.health.current}/${state.health.max} initiative ${state.initiative} guid=${combatantSave.guid}`,
	);

	gameBus.publish("EntitySpawned", {
		userId: player.UserId,
		guid: combatantSave.guid,
		entity: combatantEntity,
		kind: "combatant",
	});
	gameBus.publish("PlayerLoaded", {
		player,
		userId: player.UserId,
		playerEntity,
		combatantEntity,
		guid: combatantSave.guid,
		state,
	});
}

export function unloadPlayer(player: Player): void {
	const session = sessions.get(player.UserId);
	if (session === undefined) return;

	// Flush ECS combat stats into ProfileStore before the session ends.
	gameBus.publish("SaveRequested", { userId: player.UserId });
	intentionalSessionEnds.add(player.UserId);
	session.profile.EndSession();
	destroySession(player.UserId);
	intentionalSessionEnds.delete(player.UserId);
}

/** Studio smoke: EndSession → StartSessionAsync for the same UserId without a new client slot. */
export function reloadPlayer(player: Player): void {
	print(`[persist] soft-reload UserId=${player.UserId} name=${player.Name}`);
	unloadPlayer(player);
	loadPlayer(player);
}
