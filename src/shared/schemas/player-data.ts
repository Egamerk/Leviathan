import type { VesselId } from "shared/definitions/vessels";
import { emptyStats, type MainStats } from "shared/modules/stats/types";
import { StatsConfig } from "shared/config/stats";

/**
 * Persisted player data (ProfileStore template).
 *
 * Rules:
 *  - Only plain data (no Instances, no functions); it is saved and replicated.
 *  - Adding a field: add it here with a default. ProfileStore's `Reconcile()`
 *    fills it in for existing players automatically.
 *  - Renaming/removing a field: bump `schemaVersion` and add a migration in
 *    `server/services/data/player-data.service.ts`.
 */
export interface PlayerData {
	schemaVersion: number;
	/** Chosen at character creation. Undefined until then. */
	vessel?: VesselId;
	stats: {
		/** Points the player spent (the vessel bonus is added on top, not stored). */
		allocated: MainStats;
		unspentPoints: number;
	};
}

export const DEFAULT_PLAYER_DATA: PlayerData = {
	schemaVersion: 1,
	stats: {
		allocated: emptyStats(),
		unspentPoints: StatsConfig.startingStatPoints,
	},
};
