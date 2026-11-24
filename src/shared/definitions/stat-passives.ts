import type { MainStat } from "shared/modules/stats/types";
import { createRegistry } from "./registry";

/**
 * Trello: Universal Passives - Main Stats. A passive is unlocked while ALL its
 * requirements are met. `modifiers` are added to derived stats; other systems
 * check for a passive by id (e.g. combat checks "Riposte").
 */
export type PassiveRequirement = MainStat | "sanity" | "depthAffinity";

export interface StatPassiveDef {
	name: string;
	description: string;
	requires: Partial<Record<PassiveRequirement, number>>;
	modifiers?: { parryStrength?: number; parryChipReduction?: number };
}

export const StatPassives = createRegistry<StatPassiveDef>()({
	Riposte: {
		name: "Riposte",
		description: "Unlocks Riposte as a side action.",
		requires: { dexterity: 7 },
	},
	ResoluteWill: {
		name: "Resolute Will",
		description:
			"It is going to take a lot more to bring you down. Removes one Unconscious QTE and greatly reduces oxygen loss while Unconscious.",
		requires: { endurance: 7, sanity: 7 },
	},
	IronBulwark: {
		name: "Iron Bulwark",
		description: "A walking fortress. +3 Parry Strength, and parries negate an extra 15% chip damage.",
		requires: { strength: 8, endurance: 10 },
		modifiers: { parryStrength: 3, parryChipReduction: 0.15 },
	},
});

export type StatPassiveId = (typeof StatPassives.ids)[number];
