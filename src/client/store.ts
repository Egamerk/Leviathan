import { atom } from "@rbxts/charm";
import type { NodeId } from "shared/nav/grid";
import type * as Zap from "shared/net/zapClient";

/**
 * Client-side reactive state (Charm atoms). Controllers write, React reads.
 * Atoms hold immutable snapshots: replace, don't mutate, so subscribers fire.
 */

export type GameMode = "Explore" | "Combat";

export interface ClientCombatant {
	id: string;
	name: string;
	side: "diver" | "enemy";
	isMe: boolean;
	node: NodeId;
	health: Zap.Resource;
	stamina: Zap.Resource;
	reservoir?: Zap.Resource;
	auxiliary: Zap.Resource;
	moveStuds: number;
	abilities: string[];
	condition: "active" | "unconscious" | "dead";
	model?: Model;
}

export interface TurnView {
	actorId: string;
	round: number;
	mainUsed: boolean;
	sideUsed: boolean;
}

export interface QteView {
	windowId: number;
	kind: "Attack" | "Defense";
	qte: string;
	opensAt: number;
	closesAt: number;
	canParry: boolean;
	canDodge: boolean;
	sent: boolean;
}

export const gameMode = atom<GameMode>("Explore");
export const encounterId = atom<string | undefined>(undefined);
export const combatants = atom<ReadonlyMap<string, ClientCombatant>>(new Map());
export const turnOrder = atom<readonly string[]>([]);
export const turn = atom<TurnView | undefined>(undefined);
export const selectedAbility = atom<string>("BasicStrike");
export const qte = atom<QteView | undefined>(undefined);
/** Short-lived feedback line ("Parried!", "Not enough Stamina"…). */
export const toast = atom<string | undefined>(undefined);
/** Highest suspicion among enemies currently noticing me (0..1+). */
export const suspicion = atom<number>(0);
export const lastResult = atom<string | undefined>(undefined);

export function myCombatant(): ClientCombatant | undefined {
	for (const [, c] of combatants()) if (c.isMe) return c;
	return undefined;
}

export function isMyTurn(): boolean {
	const t = turn();
	const me = myCombatant();
	return t !== undefined && me !== undefined && t.actorId === me.id;
}

let toastToken = 0;
export function showToast(text: string, seconds = 2) {
	toastToken += 1;
	const token = toastToken;
	toast(text);
	task.delay(seconds, () => {
		if (toastToken === token) toast(undefined);
	});
}
