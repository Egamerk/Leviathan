/**
 * Global, non-gameplay configuration. Gameplay tunables should get their own
 * file in this folder (e.g. `combat.ts`, `movement.ts`) and be re-exported here.
 */
export const GameConfig = {
	/** DataStore name for player profiles. Bump the suffix to wipe all data. */
	profileStoreName: "PlayerData_v1",
	/** Prefix for each player's profile key. */
	profileKeyPrefix: "Player_",
} as const;
