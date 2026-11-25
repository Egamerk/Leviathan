import { OnStart, Service } from "@flamework/core";
import Log from "@rbxts/log";
import { StatsService } from "server/services/stats/stats.service";
import { VitalsService } from "server/services/vitals/vitals.service";
import { MAIN_STATS } from "shared/modules/stats";
import { registerDevCommand } from "./dev-commands";

/**
 * STUDIO ONLY. Chat command for testing stat-driven UI:
 *   /stats connection 2     grant 2 points and spend them on Connection
 *   (2 Connection on the default build unlocks Reservoir: Depth Affinity 2 → 3.5)
 * Vitals are refilled afterwards so new maximums show up full.
 */
@Service()
export class StatsCommandService implements OnStart {
	constructor(
		private readonly stats: StatsService,
		private readonly vitals: VitalsService,
	) {}

	public onStart(): void {
		registerDevCommand("/stats", (player, [name, value]) => {
			const stat = MAIN_STATS.find((s) => s === name);
			const amount = value !== undefined ? tonumber(value) : undefined;
			if (stat === undefined || amount === undefined || amount < 1) {
				Log.Warn("Usage: /stats <strength|dexterity|endurance|occult|connection> <points>");
				return;
			}
			if (!this.stats.grantPoints(player, amount, "studio /stats command")) return;
			const rejection = this.stats.allocate(player, stat, amount);
			if (rejection !== undefined) Log.Warn("/stats rejected: {Reason}", rejection);
			this.vitals.restore(player);
		});
	}
}
