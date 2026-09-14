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
}
