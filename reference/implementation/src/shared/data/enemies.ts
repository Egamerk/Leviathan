import type { MainStats } from "shared/rules/stats";
import type { AbilityId } from "./abilities";

/** Mirrors the Trello "Enemy Attributes → TEMPLATE CARD" so new enemies are copy-paste. */
export interface EnemyDef {
	id: string;
	name: string;
	maxHealth: number;
	defense: number;
	/** Hidden: effectiveness of push/pull on this enemy. */
	weight: "Light" | "Medium" | "Heavy";
	/** Hidden: extra combat move studs, stacks with Dexterity. */
	speedStuds: number;
	canParry: boolean;
	canDodge: boolean;
	stats: MainStats;
	abilities: AbilityId[];
	/** Roaming behaviour. */
	roam: { walkSpeed: number; pursueSpeed: number; patrolRadius: number };
}

export const Enemies = {
	Drifter: {
		id: "Drifter",
		name: "Drifter",
		maxHealth: 6,
		defense: 0.25,
		weight: "Light",
		speedStuds: 4,
		canParry: false,
		canDodge: true,
		stats: { strength: 3, dexterity: 6, endurance: 4, occult: 1, connection: 1 },
		abilities: ["DrifterClaw"],
		roam: { walkSpeed: 8, pursueSpeed: 18, patrolRadius: 30 },
	},
	SeaScorn: {
		id: "SeaScorn",
		name: "Sea Scorn",
		maxHealth: 12,
		defense: 1,
		weight: "Medium",
		speedStuds: 0,
		canParry: true,
		canDodge: false,
		stats: { strength: 6, dexterity: 6, endurance: 15, occult: 2, connection: 2 },
		abilities: ["BurningDawn"],
		roam: { walkSpeed: 6, pursueSpeed: 14, patrolRadius: 20 },
	},
} satisfies Record<string, EnemyDef>;

export type EnemyId = keyof typeof Enemies;

export function getEnemy(id: string): EnemyDef | undefined {
	return (Enemies as Record<string, EnemyDef>)[id];
}
