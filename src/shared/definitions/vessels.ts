import type { MainStat } from "shared/modules/stats/types";
import { createRegistry } from "./registry";

/**
 * Trello: Vessel → The Vessels. Each vessel puts `StatsConfig.vesselStatBonus`
 * points into its stat. Innate weapons and passives are separate systems and
 * aren't defined here yet.
 */
export interface VesselDef {
	name: string;
	title: string;
	stat: MainStat;
	/** Occultist / Apostle spawn with Reservoir (Trello: Energy Types). */
	innateReservoir: boolean;
}

export const Vessels = createRegistry<VesselDef>()({
	DepthsDredger: {
		name: "The Depths Dredger",
		title: "Abyssal Scavenger",
		stat: "strength",
		innateReservoir: false,
	},
	TideWeaver: {
		name: "The Tide Weaver",
		title: "Song of the Sea",
		stat: "dexterity",
		innateReservoir: false,
	},
	TrenchWarden: {
		name: "The Trench Warden",
		title: "Unyielding Soul",
		stat: "endurance",
		innateReservoir: false,
	},
	Occultist: {
		name: "The Occultist",
		title: "Devoted Martyr",
		stat: "occult",
		innateReservoir: true,
	},
	Apostle: {
		name: "The Apostle",
		title: "Child of the Sea",
		stat: "connection",
		innateReservoir: true,
	},
});

export type VesselId = (typeof Vessels.ids)[number];
