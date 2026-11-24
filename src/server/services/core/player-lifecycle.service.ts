import { Modding, OnInit, OnStart, Service } from "@flamework/core";
import { Players } from "@rbxts/services";
import type { OnPlayerJoined, OnPlayerLeaving } from "server/lifecycles";

/**
 * Turns `Players` events into the `OnPlayerJoined` / `OnPlayerLeaving`
 * lifecycles, so no other service has to connect to `Players` directly.
 */
@Service({ loadOrder: 0 })
export class PlayerLifecycleService implements OnInit, OnStart {
	private readonly joined = new Set<OnPlayerJoined>();
	private readonly leaving = new Set<OnPlayerLeaving>();

	public onInit(): void {
		Modding.onListenerAdded<OnPlayerJoined>((listener) => this.joined.add(listener));
		Modding.onListenerRemoved<OnPlayerJoined>((listener) => this.joined.delete(listener));
		Modding.onListenerAdded<OnPlayerLeaving>((listener) => this.leaving.add(listener));
		Modding.onListenerRemoved<OnPlayerLeaving>((listener) => this.leaving.delete(listener));
	}

	/** Dispatch only after every service has finished `onInit`. */
	public onStart(): void {
		Players.PlayerAdded.Connect((player) => this.dispatchJoined(player));
		Players.PlayerRemoving.Connect((player) => {
			for (const listener of this.leaving) task.spawn(() => listener.onPlayerLeaving(player));
		});
		for (const player of Players.GetPlayers()) this.dispatchJoined(player);
	}

	private dispatchJoined(player: Player): void {
		for (const listener of this.joined) task.spawn(() => listener.onPlayerJoined(player));
	}
}
