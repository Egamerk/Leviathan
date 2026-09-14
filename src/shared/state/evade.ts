import { atom } from "@rbxts/charm";
import type { EvadeWindowState } from "shared/ecs/types";

export const evadeWindowAtom = atom<EvadeWindowState | undefined>(undefined);

export function setEvadeWindow(state: EvadeWindowState | undefined): void {
	evadeWindowAtom(state);
}
