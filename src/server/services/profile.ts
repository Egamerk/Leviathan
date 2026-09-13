import ProfileStore from "@rbxts/profile-store";
import { Players, RunService } from "@rbxts/services";
import type { Entity } from "@rbxts/jecs";
import type { EntitySave, ProfileTemplate } from "shared/ecs/types";
import {
	Dummy,
	Guid,
	Money,
	Name,
	OwnerUserId,
	Persistent,
	Player,
	UserId,
} from "shared/ecs/components";
import { gameBus } from "shared/ecs/bus";
import { world } from "shared/ecs/world";
import { createGuid } from "shared/util";

const PROFILE_TEMPLATE: ProfileTemplate = {
	version: 1,
	money: 100,
	entities: {},
	regions: {},
};

const playerStore = ProfileStore.New("PlayerData", PROFILE_TEMPLATE);
const dataStore = RunService.IsStudio() ? playerStore.Mock : playerStore;

export interface PlayerSession {
	player: Player;
	profile: ProfileStore.Profile<ProfileTemplate>;
	playerEntity: Entity;
	dummyEntity: Entity;
	dummyGuid: string;
}

const sessions = new Map<number, PlayerSession>();
const entitiesByGuid = new Map<string, Entity>();

export function getProfile(player: Player): ProfileStore.Profile<ProfileTemplate> | undefined {
	return sessions.get(player.UserId)?.profile;
}

export function getSession(userId: number): PlayerSession | undefined {
	return sessions.get(userId);
}

export function getEntityByGuid(guid: string): Entity | undefined {
	return entitiesByGuid.get(guid);
}

function getOrCreateDummy(profile: ProfileStore.Profile<ProfileTemplate>): EntitySave {
	for (const [, saved] of pairs(profile.Data.entities)) {
		if (saved.kind === "dummy") return saved;
	}

	const guid = createGuid();
	const dummy: EntitySave = {
		guid,
		kind: "dummy",
		components: {
			money: profile.Data.money,
		},
	};
	profile.Data.entities[guid] = dummy;
	return dummy;
}

function destroySession(userId: number): void {
	const session = sessions.get(userId);
	if (session === undefined) return;

	gameBus.publish("EntityDespawned", {
		userId,
		guid: session.dummyGuid,
	});

	entitiesByGuid.delete(session.dummyGuid);
	if (world.contains(session.dummyEntity)) world.delete(session.dummyEntity);
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
		if (player.Parent === Players) {
			player.Kick("Your data session ended. Please rejoin.");
		}
	});

	if (player.Parent !== Players) {
		profile.EndSession();
		return;
	}

	const dummySave = getOrCreateDummy(profile);
	const money = dummySave.components.money ?? profile.Data.money;
	profile.Data.money = money;

	const playerEntity = world.entity();
	world.add(playerEntity, Player);
	world.set(playerEntity, UserId, player.UserId);
	world.set(playerEntity, Name, player.Name);

	const dummyEntity = world.entity();
	world.add(dummyEntity, Dummy);
	world.add(dummyEntity, Persistent);
	world.set(dummyEntity, Guid, dummySave.guid);
	world.set(dummyEntity, OwnerUserId, player.UserId);
	world.set(dummyEntity, Money, money);

	const session: PlayerSession = {
		player,
		profile,
		playerEntity,
		dummyEntity,
		dummyGuid: dummySave.guid,
	};
	sessions.set(player.UserId, session);
	entitiesByGuid.set(dummySave.guid, dummyEntity);

	gameBus.publish("EntitySpawned", {
		userId: player.UserId,
		guid: dummySave.guid,
		entity: dummyEntity,
		kind: "dummy",
	});
	gameBus.publish("PlayerLoaded", {
		player,
		userId: player.UserId,
		playerEntity,
		dummyEntity,
		guid: dummySave.guid,
		money,
	});
}

export function unloadPlayer(player: Player): void {
	const session = sessions.get(player.UserId);
	if (session === undefined) return;

	// The bus is synchronous: persistence writes the latest ECS state before
	// EndSession performs ProfileStore's final save.
	gameBus.publish("SaveRequested", { userId: player.UserId });
	session.profile.EndSession();
	destroySession(player.UserId);
}
