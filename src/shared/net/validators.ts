import { t } from "@rbxts/t";
import type { PlayerDelta } from "./types";

export const playerDeltaCheck: t.check<PlayerDelta> = t.interface({
	guid: t.string,
	money: t.number,
});

export function assertPlayerDelta(value: unknown): PlayerDelta {
	assert(playerDeltaCheck(value), "Invalid PlayerDelta at network boundary");
	return value;
}
