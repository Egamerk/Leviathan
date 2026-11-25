import { StatsConfig } from "shared/config/stats";
import type { DerivedStats } from "shared/modules/stats";
import type { Vitals } from "shared/schemas/vitals";

/** HUD elements that can be hovered. */
export type HudElement = "oxygen" | "health" | "auxiliary" | "stamina" | "reservoir";

export interface TooltipContent {
	title: string;
	/** e.g. "3 / 4", "100%", "Locked". */
	value: string;
	/** What it is / does. */
	description: string;
	/** Rules: regeneration, recovery, unlock condition… */
	detail: string;
	/** Accent colour for the title (matches the resource). */
	accent: Color3;
}

export interface TooltipInputs {
	vitals?: Vitals;
	stats?: DerivedStats;
	oxygen: number;
}

/** "3", "3.5", never "3.50" or "3.0". */
export function formatValue(value: number): string {
	const rounded = math.round(value * 10) / 10;
	return rounded % 1 === 0 ? tostring(rounded) : string.format("%.1f", rounded);
}

const pair = (current: number | undefined, max: number | undefined) =>
	current === undefined || max === undefined ? "—" : `${formatValue(current)} / ${formatValue(max)}`;

const R = StatsConfig.recover;

/** Tooltip text for each element, from the Trello rules and the player's live values. */
export function tooltipFor(element: HudElement, input: TooltipInputs): TooltipContent {
	const { vitals, stats } = input;
	switch (element) {
		case "health":
			return {
				title: "Health",
				value: pair(vitals?.health, stats?.maxHealth),
				description: `How much punishment your body can take. At 0 you fall unconscious and can't act; a single hit above ${math.round(StatsConfig.implodeRatio * 100)}% of your maximum implodes you.`,
				detail: `Recover: +${R.health}  ·  Endurance raises your maximum`,
				accent: Color3.fromRGB(214, 92, 84),
			};
		case "oxygen":
			return {
				title: "Oxygen",
				value: `${math.round(input.oxygen * 100)}%`,
				description: "Air left in your suit's tanks.",
				detail: "While unconscious you lose oxygen every turn",
				accent: Color3.fromRGB(150, 210, 236),
			};
		case "auxiliary":
			return {
				title: "Auxiliary",
				value: pair(vitals?.auxiliary, stats?.maxAuxiliary),
				description: "Powers your Equipment: the Lantern, Hookshot and other tools.",
				detail: `Doesn't regenerate: +${StatsConfig.auxiliaryPerBattle} after each battle, refilled when you extract or respawn`,
				accent: Color3.fromRGB(232, 142, 64),
			};
		case "stamina":
			return {
				title: "Stamina",
				value: pair(vitals?.stamina, stats?.maxStamina),
				description: "Spent on physical attacks.",
				detail: `+${StatsConfig.staminaPerTurn} every turn  ·  Recover: +${R.stamina}`,
				accent: Color3.fromRGB(120, 196, 90),
			};
		case "reservoir": {
			if (stats !== undefined && !stats.hasReservoir) {
				return {
					title: "Reservoir",
					value: "Locked",
					description: "Energy drawn from the depths, used for ritual casting and ranged magic.",
					detail: `Unlocks at ${StatsConfig.reservoirDepthAffinity} Depth Affinity (you have ${formatValue(stats.depthAffinity)}), or as an Occultist or Apostle`,
					accent: Color3.fromRGB(176, 136, 240),
				};
			}
			return {
				title: "Reservoir",
				value: pair(vitals?.reservoir, stats?.maxReservoir),
				description: "Energy drawn from the depths, used for ritual casting and ranged magic.",
				detail: `Doesn't regenerate on its own  ·  Recover: +${R.reservoir}  ·  Rituals restore more`,
				accent: Color3.fromRGB(176, 136, 240),
			};
		}
	}
}
