import { atom } from "@rbxts/charm";
import type { PlayerData } from "shared/schemas/player-data";

/**
 * Client state (Charm atoms).
 *
 *  - "Synced" atoms are written ONLY by `StateSyncController` from server
 *    patches. Treat them as read-only.
 *  - Local atoms (UI state, selections, settings) can be written freely by
 *    controllers.
 *
 * React reads any atom through `useAtom` (client/ui/hooks/use-atom.ts).
 */

// ── Synced from server (see shared/schemas/synced-state.ts) ─────────────────
export const playerDataAtom = atom<PlayerData | undefined>(undefined);

// ── Local ────────────────────────────────────────────────────────────────────
