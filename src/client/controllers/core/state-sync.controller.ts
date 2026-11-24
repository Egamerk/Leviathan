import { Controller, OnStart } from "@flamework/core";
import { client as CharmSync, type SyncPayload } from "@rbxts/charm-sync";
import { Network } from "client/network";
import { playerDataAtom } from "client/store";
import type { SyncedState } from "shared/schemas/synced-state";

type SyncSetters = { [K in keyof SyncedState]: (value: SyncedState[K]) => unknown };

/**
 * Receives Charm Sync patches from the server and applies them to the
 * client's synced atoms. Keys must match `SyncedState` exactly.
 */
@Controller()
export class StateSyncController implements OnStart {
	public onStart(): void {
		const setters: SyncSetters = {
			playerData: playerDataAtom,
		};
		CharmSync.addSignals(setters);

		Network.syncState.setCallback((payloads) => CharmSync.patch(payloads as SyncPayload[]));
		Network.requestState.fire();
	}
}
