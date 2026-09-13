import { computed } from "@rbxts/charm";
import { Players } from "@rbxts/services";
import { getPlayerState } from "./players";

/** Client convenience selector over the shared player-state mirror. */
export const moneyAtom = computed(() => getPlayerState(Players.LocalPlayer.UserId).money);
