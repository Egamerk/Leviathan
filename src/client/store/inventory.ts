import { atom } from "@rbxts/charm";

/**
 * Local inventory state, written only by `InventoryController`.
 *
 * `toolsAtom` holds every Tool the player has (Backpack + the equipped one) in
 * the order they were received. The hotbar shows the first `HOTBAR_SLOTS` of
 * them; the inventory panel shows all of them.
 */
export const toolsAtom = atom<ReadonlyArray<Tool>>([]);

/** The Tool currently in the character's hands, if any. */
export const equippedToolAtom = atom<Tool | undefined>(undefined);

/** Whether the inventory panel is open. */
export const inventoryOpenAtom = atom(false);
