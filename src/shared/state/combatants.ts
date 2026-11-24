import { atom } from "@rbxts/charm";
import type { CombatantState } from "shared/ecs/types";

export const combatantsAtom = atom<Record<string, CombatantState>>({});
export const localCombatantGuidAtom = atom<string | undefined>(undefined);

export function applyCombatantSnapshot(state: CombatantState, isLocal = false): void {
	combatantsAtom((current) => ({
		...current,
		[state.guid]: state,
	}));
	if (isLocal) localCombatantGuidAtom(state.guid);
}

export function removeCombatantState(guid: string): void {
	combatantsAtom((current) => {
		const updated = { ...current };
		delete updated[guid];
		return updated;
	});
	if (localCombatantGuidAtom() === guid) localCombatantGuidAtom(undefined);
}
