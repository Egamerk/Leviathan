/**
 * Custom Flamework lifecycle events for the client. Any `@Controller` (or
 * `@Component`) implementing one of these is called automatically; see
 * `controllers/core/character-lifecycle.controller.ts`.
 */

/** The local player's character spawned (also fires for an existing character on start). */
export interface OnCharacterAdded {
	onCharacterAdded(character: Model): void;
}

/** The local player's character is being removed (death, respawn, leaving). */
export interface OnCharacterRemoving {
	onCharacterRemoving(character: Model): void;
}
