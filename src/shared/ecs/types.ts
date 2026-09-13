/** State visible to one player and mirrored to their client. */
export interface PlayerState {
	money: number;
}

export interface EntitySave {
	guid: string;
	kind: "dummy";
	components: {
		money?: number;
	};
}

export interface RegionChunk {
	version: number;
	entities: Record<string, EntitySave>;
}

export interface ProfileTemplate {
	version: number;
	money: number;
	entities: Record<string, EntitySave>;
	regions: Record<string, RegionChunk>;
}
