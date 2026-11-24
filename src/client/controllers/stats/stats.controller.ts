import { Controller } from "@flamework/core";
import { Network } from "client/network";
import { playerDataAtom } from "client/store";
import { type AllocationError, checkAllocation, type MainStat } from "shared/modules/stats";

/**
 * Client entry point for stat actions. UI calls `allocate`; the result comes
 * back through the synced PlayerData, so there's no local bookkeeping.
 */
@Controller()
export class StatsController {
	/** Same check the server runs, for disabling buttons before sending. */
	public canAllocate(stat: MainStat, amount = 1): AllocationError | "NotLoaded" | undefined {
		const data = playerDataAtom();
		if (data === undefined) return "NotLoaded";
		return checkAllocation(data.stats.allocated, data.stats.unspentPoints, stat, amount, data.vessel);
	}

	public allocate(stat: MainStat, amount = 1): boolean {
		if (this.canAllocate(stat, amount) !== undefined) return false;
		Network.allocateStat.fire({ stat, amount });
		return true;
	}
}
