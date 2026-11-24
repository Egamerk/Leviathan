import { OnStart, Service } from "@flamework/core";
import { server as CharmSync } from "@rbxts/charm-sync";
import type { OnPlayerLeaving } from "server/lifecycles";
import { Network } from "server/network";
import { playerDataAtom, vitalsAtom } from "server/store";
import type { SyncedState } from "shared/schemas/synced-state";

type SyncGetters = { [K in keyof SyncedState]: () => SyncedState[K] };

/**
 * Replicates server atoms to clients with Charm Sync (delta-compressed).
 *
 * To replicate something new: add its key to `SyncedState`, return a getter
 * for it in `gettersFor`, and register a matching atom in the client's
 * `StateSyncController`.
 */
@Service()
export class StateSyncService implements OnStart, OnPlayerLeaving {
	public onStart(): void {
		CharmSync.connect((player, payloads) => Network.syncState.fire(player, payloads));

		// Clients request state once their signals are registered, so the initial
		// snapshot can't arrive before they're ready for it.
		Network.requestState.setCallback((player) => {
			CharmSync.removeClient(player);
			CharmSync.addSignalsToClient(player, this.gettersFor(player));
		});
	}

	public onPlayerLeaving(player: Player): void {
		CharmSync.removeClient(player);
	}

	/** Per-player view of server state. Only send each client what it may see. */
	private gettersFor(player: Player): SyncGetters {
		return {
			playerData: () => playerDataAtom().get(player.UserId),
			vitals: () => vitalsAtom().get(player.UserId),
		};
	}
}
