import { Players } from "@rbxts/services";
import { Money } from "shared/ecs/components";
import { gameBus } from "shared/ecs/bus";
import { world } from "shared/ecs/world";
import Net from "shared/net/server";
import { assertPlayerDelta } from "shared/net/validators";
import { applyMoneyDelta, applyPlayerSnapshot, removePlayerState } from "shared/state/players";
import { getSession } from "server/services/profile";

const readyPlayers = new Set<number>();

function replicate(userId: number, guid: string, money: number): void {
	const player = Players.GetPlayerByUserId(userId);
	if (player === undefined || !readyPlayers.has(userId)) return;

	Net.replicatePlayer.fire(player, assertPlayerDelta({ guid, money }));
}

/** The only server system that knows clients or Zap exist. */
export function startReplicationSystem(): void {
	Net.getPing.setCallback(() => math.floor(os.clock() * 1000) % 65536);

	Net.ready.setCallback((player) => {
		readyPlayers.add(player.UserId);

		const session = getSession(player.UserId);
		if (session === undefined) return;

		const money = world.get(session.dummyEntity, Money);
		if (money !== undefined) {
			replicate(player.UserId, session.dummyGuid, money);
		}
	});

	gameBus.subscribe("PlayerLoaded", ({ userId, guid, money }) => {
		applyPlayerSnapshot(userId, { money });
		replicate(userId, guid, money);
	});

	gameBus.subscribe("MoneyChanged", ({ userId, guid, money }) => {
		applyMoneyDelta(userId, money);
		replicate(userId, guid, money);
	});

	gameBus.subscribe("EntityDespawned", ({ userId }) => {
		removePlayerState(userId);
	});

	Players.PlayerRemoving.Connect((player) => {
		readyPlayers.delete(player.UserId);
	});
}
