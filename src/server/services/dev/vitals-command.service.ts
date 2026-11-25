import { OnStart, Service } from "@flamework/core";
import Log from "@rbxts/log";
import { VitalsService } from "server/services/vitals/vitals.service";
import type { VitalName } from "shared/schemas/vitals";
import { registerDevCommand } from "./dev-commands";

const VITALS: readonly VitalName[] = ["health", "stamina", "auxiliary", "reservoir"];

/**
 * STUDIO ONLY. Chat commands for testing the HUD:
 *   /vitals health 2        set a pool
 *   /vitals stamina -1      (prefix +/- to change relative to current)
 *   /vitals full            refill everything
 */
@Service()
export class VitalsCommandService implements OnStart {
	constructor(private readonly vitals: VitalsService) {}

	public onStart(): void {
		registerDevCommand("/vitals", (player, [name, value]) => {
			if (name === "full") {
				this.vitals.restore(player);
				return;
			}
			const vital = VITALS.find((v) => v === name);
			const amount = value !== undefined ? tonumber(value) : undefined;
			if (vital === undefined || amount === undefined) {
				Log.Warn("Usage: /vitals <health|stamina|auxiliary|reservoir> <amount | +n | -n>, or /vitals full");
				return;
			}
			const first = value.sub(1, 1);
			const ok =
				first === "+" || first === "-"
					? this.vitals.change(player, { [vital]: amount })
					: this.vitals.set(player, { [vital]: amount });
			if (!ok) Log.Warn("/vitals: {Player}'s data isn't loaded yet", player.Name);
		});
	}
}
