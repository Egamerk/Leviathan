<<<<<<< HEAD
import { Players } from "@rbxts/services";
import { CombatConfig } from "shared/config";
import { ServerNet } from "shared/net/server";
import { deriveStats, type MainStats } from "shared/rules/stats";

/**
 * Server-side record for each diver. This is the seam where ProfileStore will
 * plug in later (character slot, stats, loadout, permadeath wipe); for now the
 * defaults stand in for character creation.
 */

export type Phase = "Explore" | "Combat" | "Down";

export interface DiverRecord {
	player: Player;
	phase: Phase;
	stats: MainStats;
	health: number;
	stamina: number;
	reservoir: number;
	auxiliary: number;
	abilities: string[];
	crouching: boolean;
	sprinting: boolean;
	encounterId?: string;
}

const records = new Map<Player, DiverRecord>();

const DEFAULT_STATS: MainStats = { strength: 4, dexterity: 6, endurance: 4, occult: 2, connection: 2 };

export function getDiver(player: Player): DiverRecord | undefined {
	return records.get(player);
}

export function allDivers(): DiverRecord[] {
	const out = new Array<DiverRecord>();
	for (const [, record] of records) out.push(record);
	return out;
}

/** Every diver whose character is alive and who isn't already fighting. */
export function exploringDivers(): DiverRecord[] {
	return allDivers().filter(
		(d) => d.phase === "Explore" && d.player.Character?.FindFirstChild("HumanoidRootPart") !== undefined,
	);
}

function createRecord(player: Player): DiverRecord {
	const derived = deriveStats(DEFAULT_STATS);
	return {
		player,
		phase: "Explore",
		stats: { ...DEFAULT_STATS },
		health: derived.maxHealth,
		stamina: derived.maxStamina,
		reservoir: derived.hasReservoir ? derived.maxReservoir : 0,
		auxiliary: CombatConfig.baseMaxAuxiliary,
		abilities: ["BasicStrike", "TideFangLunge"],
		crouching: false,
		sprinting: false,
	};
}

export function startPlayersService(onLeaving: (record: DiverRecord) => void) {
	const add = (player: Player) => records.set(player, createRecord(player));
	Players.PlayerAdded.Connect(add);
	for (const player of Players.GetPlayers()) add(player);

	Players.PlayerRemoving.Connect((player) => {
		const record = records.get(player);
		if (record) onLeaving(record);
		records.delete(player);
	});

	ServerNet.setStance.setCallback((player, stance) => {
		const record = records.get(player);
		if (record === undefined) return;
		record.crouching = stance.crouching;
		record.sprinting = stance.sprinting;
	});
=======
import { Players, ReplicatedStorage, RunService } from "@rbxts/services";
import { loadPlayer, reloadPlayer, unloadPlayer } from "server/services/profile";

const PERSIST_RELOAD_REMOTE = "PersistReload";

function bindStudioPersistReload(): void {
	if (!RunService.IsStudio()) return;

	const remote = new Instance("RemoteEvent");
	remote.Name = PERSIST_RELOAD_REMOTE;
	remote.Parent = ReplicatedStorage;
	remote.OnServerEvent.Connect((player) => {
		task.spawn(() => reloadPlayer(player));
	});

	print(`[persist] Studio soft-reload: press P (same client window)`);
}

export function startPlayersService(): void {
	Players.PlayerAdded.Connect((player) => {
		task.spawn(() => loadPlayer(player));
	});

	Players.PlayerRemoving.Connect((player) => {
		unloadPlayer(player);
	});

	for (const player of Players.GetPlayers()) {
		task.spawn(() => loadPlayer(player));
	}

	bindStudioPersistReload();
>>>>>>> parent of 2163304 (Describe what you added or fixed)
}
