/**
 * Custom Flamework lifecycle events for the server. Any `@Service` (or
 * `@Component`) that implements one of these interfaces is called
 * automatically; see `services/core/player-lifecycle.service.ts`.
 */

/** A player joined. Also fires for players already in game when the server starts. */
export interface OnPlayerJoined {
	onPlayerJoined(player: Player): void;
}

/** A player is leaving. Runs before their profile is released. */
export interface OnPlayerLeaving {
	onPlayerLeaving(player: Player): void;
}

/** A player's profile finished loading and is safe to read/write. */
export interface OnPlayerDataLoaded {
	onPlayerDataLoaded(player: Player): void;
}
