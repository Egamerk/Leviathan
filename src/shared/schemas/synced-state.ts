import type { PlayerData } from "./player-data";
import type { Vitals } from "./vitals";

/**
 * The state each client receives through Charm Sync, keyed by signal name.
 * The server's `StateSyncService` and the client's `StateSyncController` both
 * use these keys, so adding replicated state means adding a key here first.
 */
export interface SyncedState {
	/** The local player's own persisted data. */
	playerData: PlayerData | undefined;
	/** The local player's current Health / Stamina / Auxiliary / Reservoir. */
	vitals: Vitals | undefined;
}
