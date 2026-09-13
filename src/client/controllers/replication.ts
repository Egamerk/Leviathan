import { Players } from "@rbxts/services";
import Net from "shared/net/client";
import { assertPlayerDelta } from "shared/net/validators";
import { applyMoneyDelta } from "shared/state/players";

/** Validates server deltas at the client boundary and updates Charm mirrors. */
export function startReplicationController(): void {
	const localPlayer = Players.LocalPlayer;

	Net.replicatePlayer.setCallback((untrustedDelta) => {
		const delta = assertPlayerDelta(untrustedDelta);
		applyMoneyDelta(localPlayer.UserId, delta.money);
	});

	Net.ready.fire();

	task.spawn(() => {
		const ping = Net.getPing.call();
		print(`[client] ping returned ${ping}`);
	});
}
