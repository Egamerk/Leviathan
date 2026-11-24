import type { ReactionType } from "shared/data/abilities";

export interface ResourceState {
	current: number;
	max: number;
}

/** Server-authored state visible to the owning player through Charm. */
export interface CombatantState {
	guid: string;
	health: ResourceState;
	stamina: ResourceState;
	initiative: number;
	movementPoints: number;
}

export interface EvadeWindowState {
	encounterId: string;
	windowId: string;
	reaction: ReactionType;
	openAt: number;
	closeAt: number;
	opened: boolean;
	resolved: boolean;
	success?: boolean;
}

export interface EntitySave {
	guid: string;
	kind: "combatant";
	components: {
		health?: ResourceState;
		stamina?: ResourceState;
		initiative?: number;
		movementPoints?: number;
	};
}

export interface RegionChunk {
	version: number;
	entities: Record<string, EntitySave>;
}

export interface ProfileTemplate {
	version: number;
	entities: Record<string, EntitySave>;
	regions: Record<string, RegionChunk>;
}
