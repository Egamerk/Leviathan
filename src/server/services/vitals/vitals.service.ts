import { OnStart, Service } from "@flamework/core";
import { subscribe } from "@rbxts/charm";
import { Players } from "@rbxts/services";
import type { OnPlayerDataLoaded, OnPlayerLeaving } from "server/lifecycles";
import { StatsService } from "server/services/stats/stats.service";
import { playerDataAtom, vitalsAtom, withEntry } from "server/store";
import { clampVitals, fullVitals, type Vitals } from "shared/schemas/vitals";

/**
 * Owns each player's current Health / Stamina / Auxiliary / Reservoir.
 * Players spawn full; values are always clamped to the maximums from
 * StatsService, including when stats change. Combat and other systems change
 * vitals ONLY through `set` / `change` / `restore`.
 */
@Service()
export class VitalsService implements OnStart, OnPlayerDataLoaded, OnPlayerLeaving {
	constructor(private readonly stats: StatsService) {}

	public onStart(): void {
		// Stat changes alter maximums: re-clamp everyone (e.g. Reservoir unlocking).
		subscribe(playerDataAtom, () => {
			for (const player of Players.GetPlayers()) {
				const current = this.get(player);
				if (current !== undefined) this.set(player, current);
			}
		});
	}

	public onPlayerDataLoaded(player: Player): void {
		this.restore(player);
	}

	public onPlayerLeaving(player: Player): void {
		vitalsAtom((map) => withEntry(map, player.UserId, undefined));
	}

	public get(player: Player): Readonly<Vitals> | undefined {
		return vitalsAtom().get(player.UserId);
	}

	/** Overwrite some or all pools (clamped). Returns false if the player isn't loaded. */
	public set(player: Player, values: Partial<Vitals>): boolean {
		const derived = this.stats.getDerived(player);
		const current = this.get(player);
		if (derived === undefined || current === undefined) return false;
		const clamped = clampVitals({ ...current, ...values }, derived);
		vitalsAtom((map) => withEntry(map, player.UserId, clamped));
		return true;
	}

	/** Add (or subtract, with negative amounts) to pools, clamped. */
	public change(player: Player, deltas: Partial<Vitals>): boolean {
		const current = this.get(player);
		if (current === undefined) return false;
		return this.set(player, {
			health: current.health + (deltas.health ?? 0),
			stamina: current.stamina + (deltas.stamina ?? 0),
			auxiliary: current.auxiliary + (deltas.auxiliary ?? 0),
			reservoir: current.reservoir + (deltas.reservoir ?? 0),
		});
	}

	/** Refill every pool to its maximum. */
	public restore(player: Player): boolean {
		const derived = this.stats.getDerived(player);
		if (derived === undefined) return false;
		vitalsAtom((map) => withEntry(map, player.UserId, fullVitals(derived)));
		return true;
	}
}
