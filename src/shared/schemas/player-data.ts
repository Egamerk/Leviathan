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
}

export const DEFAULT_PLAYER_DATA: PlayerData = {
	schemaVersion: 1,
};
