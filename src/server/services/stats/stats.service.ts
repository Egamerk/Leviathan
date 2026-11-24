import { OnStart, Service } from "@flamework/core";
import Log from "@rbxts/log";
import { Network } from "server/network";
import { PlayerDataService } from "server/services/data/player-data.service";
import { Vessels, type VesselId } from "shared/definitions/vessels";
import {
	type AllocationError,
	checkAllocation,
	type DerivedStats,
	deriveStats,
	type MainStat,
} from "shared/modules/stats";

/**
 * Server API for base stats. Stat data lives in PlayerData (persisted and
 * replicated); this service is the only code that writes it.
 *
 * Other systems read numbers with `getDerived(player)`. Clients compute the
 * same values locally from their synced data (client/store/stats.ts).
 */
@Service()
export class StatsService implements OnStart {
	private readonly logger = Log.ForContext(StatsService);

	constructor(private readonly playerData: PlayerDataService) {}

	public onStart(): void {
		Network.allocateStat.setCallback((player, { stat, amount }) => {
			const rejection = this.allocate(player, stat, amount);
			if (rejection !== undefined)
				this.logger.Debug("{Player} allocate {Stat} rejected: {Error}", player.Name, stat, rejection);
		});
	}

	/** Derived stats for a loaded player, or undefined while their profile loads. */
	public getDerived(player: Player): DerivedStats | undefined {
		const data = this.playerData.get(player);
		return data && deriveStats(data.stats.allocated, data.vessel);
	}

	/** Spend unspent points on a stat. Returns why it failed, or undefined on success. */
	public allocate(player: Player, stat: MainStat, amount: number): AllocationError | "NotLoaded" | undefined {
		const data = this.playerData.get(player);
		if (data === undefined) return "NotLoaded";
		const rejection = checkAllocation(data.stats.allocated, data.stats.unspentPoints, stat, amount, data.vessel);
		if (rejection !== undefined) return rejection;

		this.playerData.update(player, (current) => ({
			...current,
			stats: {
				allocated: { ...current.stats.allocated, [stat]: current.stats.allocated[stat] + amount },
				unspentPoints: current.stats.unspentPoints - amount,
			},
		}));
		return undefined;
	}

	/** Award stat points (Trello: completed Contracts grant Stat Points). */
	public grantPoints(player: Player, amount: number, reason: string): boolean {
		if (amount <= 0 || amount % 1 !== 0) return false;
		const ok = this.playerData.update(player, (current) => ({
			...current,
			stats: { ...current.stats, unspentPoints: current.stats.unspentPoints + amount },
		}));
		if (ok) this.logger.Info("{Player} granted {Amount} stat point(s): {Reason}", player.Name, amount, reason);
		return ok;
	}

	/** Set the vessel once (character creation). Returns false if one is already chosen. */
	public setVessel(player: Player, vessel: VesselId): boolean {
		const data = this.playerData.get(player);
		if (data === undefined || data.vessel !== undefined || !Vessels.has(vessel)) return false;
		return this.playerData.update(player, (current) => ({ ...current, vessel }));
	}
}
