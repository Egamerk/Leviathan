/**
 * Typed, read-only registry for static content (abilities, enemies, items…).
 *
 * ```ts
 * export const Items = createRegistry({
 *     Lantern: { name: "Lantern", weight: 1 },
 * });
 * Items.get("Lantern"); // typed; unknown ids are a compile error
 * ```
 *
 * Definitions are data only. Behaviour lives in services or shared modules
 * that look definitions up by id.
 */
export interface Registry<Id extends string, Def> {
	readonly ids: readonly Id[];
	readonly get: (id: Id) => Def;
	readonly find: (id: string) => Def | undefined;
	readonly has: (id: string) => id is Id;
}

export function createRegistry<Defs extends Record<string, object>>(
	definitions: Defs,
): Registry<keyof Defs & string, Defs[keyof Defs] & { id: keyof Defs & string }> {
	type Id = keyof Defs & string;
	type Def = Defs[keyof Defs] & { id: Id };

	const entries = new Map<string, Def>();
	const ids = new Array<Id>();
	for (const [id, definition] of pairs(definitions)) {
		entries.set(id as string, table.freeze({ ...(definition as object), id }) as Def);
		ids.push(id as Id);
	}
	table.freeze(ids);

	return {
		ids,
		get: (id) => entries.get(id)!,
		find: (id) => entries.get(id),
		has: (id): id is Id => entries.has(id),
	};
}
