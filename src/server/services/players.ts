import { Players } from "@rbxts/services";
import { loadPlayer, unloadPlayer } from "server/services/profile";

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
}
