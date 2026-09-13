import { atom } from "@rbxts/charm";
import type { PlayerState } from "shared/ecs/types";

const DEFAULT_PLAYER_STATE: PlayerState = {
	money: 0,
};

/** Per-player reactive state keyed by UserId string. */
export const playersAtom = atom<Record<string, PlayerState>>({});

export function getPlayerState(userId: number): PlayerState {
	return playersAtom()[tostring(userId)] ?? DEFAULT_PLAYER_STATE;
}

export function applyPlayerSnapshot(userId: number, state: PlayerState): void {
	playersAtom((current) => ({
		...current,
		[tostring(userId)]: state,
	}));
}

export function applyMoneyDelta(userId: number, money: number): void {
	const key = tostring(userId);
	playersAtom((current) => ({
		...current,
		[key]: {
			...(current[key] ?? DEFAULT_PLAYER_STATE),
			money,
		},
	}));
}

export function removePlayerState(userId: number): void {
	playersAtom((current) => {
		const updated = { ...current };
		delete updated[tostring(userId)];
		return updated;
	});
}
