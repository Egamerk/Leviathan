import { atom } from "@rbxts/charm";
import type { EncounterSnapshot } from "shared/net/types";

export const encounterAtom = atom<EncounterSnapshot | undefined>(undefined);

export function applyEncounterSnapshot(snapshot: EncounterSnapshot): void {
	encounterAtom(snapshot);
}

export function clearEncounterSnapshot(): void {
	encounterAtom(undefined);
}
