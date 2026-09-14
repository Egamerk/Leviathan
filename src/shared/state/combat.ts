import { computed } from "@rbxts/charm";
import type { CombatantState } from "shared/ecs/types";
import { combatantsAtom, localCombatantGuidAtom } from "./combatants";

/** Local player's replicated authoritative combat state. */
export const combatantAtom = computed<CombatantState | undefined>(() => {
	const guid = localCombatantGuidAtom();
	return guid !== undefined ? combatantsAtom()[guid] : undefined;
});
