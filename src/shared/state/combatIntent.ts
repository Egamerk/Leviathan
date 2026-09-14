import { atom } from "@rbxts/charm";
import type { AbilityId } from "shared/data/abilities";

export type CombatIntentMode = "none" | "attack" | "move";

export interface CombatIntent {
	mode: CombatIntentMode;
	abilityId?: AbilityId;
	targetGuid?: string;
	destX?: number;
	destY?: number;
	destZ?: number;
}

export const combatIntentAtom = atom<CombatIntent>({ mode: "none" });

export function clearCombatIntent(): void {
	combatIntentAtom({ mode: "none" });
}

export function selectAttackAbility(abilityId: AbilityId): void {
	combatIntentAtom({ mode: "attack", abilityId });
}

export function selectMoveMode(): void {
	combatIntentAtom({ mode: "move" });
}

export function cancelCombatIntent(): void {
	clearCombatIntent();
}

export function setAttackTarget(targetGuid: string): void {
	const current = combatIntentAtom();
	if (current.mode !== "attack") return;
	combatIntentAtom({ ...current, targetGuid });
}

export function setMoveDestination(dest: Vector3): void {
	const current = combatIntentAtom();
	if (current.mode !== "move") return;
	combatIntentAtom({ ...current, destX: dest.X, destY: dest.Y, destZ: dest.Z });
}
