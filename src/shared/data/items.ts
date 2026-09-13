export interface ItemDefinition {
	name: string;
	maxStack: number;
}

/** Static authored data. An item becomes ECS data only when instantiated. */
export const ITEM_DEFINITIONS = {
	trainingSword: {
		name: "Training Sword",
		maxStack: 1,
	},
	healthPotion: {
		name: "Health Potion",
		maxStack: 10,
	},
} satisfies Record<string, ItemDefinition>;

export type ItemId = keyof typeof ITEM_DEFINITIONS;
