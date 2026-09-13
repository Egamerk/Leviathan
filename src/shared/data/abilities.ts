export interface AbilityDefinition {
	name: string;
	cooldownSeconds: number;
}

/** Static authored data. Runtime cooldowns belong in ECS components. */
export const ABILITY_DEFINITIONS = {
	basicAttack: {
		name: "Basic Attack",
		cooldownSeconds: 1,
	},
} satisfies Record<string, AbilityDefinition>;

export type AbilityId = keyof typeof ABILITY_DEFINITIONS;
