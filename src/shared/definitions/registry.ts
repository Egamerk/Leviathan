/**
 * Typed, read-only registry for static content (abilities, enemies, items…).
 *
 * ```ts
 * interface ItemDef { name: string; weight: number }
 * export const Items = createRegistry<ItemDef>()({
 *     Lantern: { name: "Lantern", weight: 1 },
 * });
 * Items.get("Lantern"); // ItemDef & { id }; unknown ids are a compile error
 * ```
 *
 * The curried call lets TypeScript keep the ids as literals while checking
 * every entry against the declared `Def` shape. Definitions are frozen data;
 * behaviour lives in services/modules that look them up by id.
 */
export interface Registry<Id extends string, Def> {
	readonly ids: readonly Id[];
	readonly get: (id: Id) => Readonly<Def & { id: Id }>;
	readonly find: (id: string) => Readonly<Def & { id: Id }> | undefined;
	readonly has: (id: string) => id is Id;
}

export function createRegistry<Def extends object>() {
	return <Defs extends Record<string, Def>>(definitions: Defs): Registry<keyof Defs & string, Def> => {
		type Id = keyof Defs & string;
		type Entry = Readonly<Def & { id: Id }>;

		const entries = new Map<string, Entry>();
		const ids = new Array<Id>();
		for (const [id, definition] of pairs(definitions)) {
			entries.set(id as string, table.freeze({ ...(definition as object), id }) as unknown as Entry);
			ids.push(id as Id);
		}
		ids.sort();
		table.freeze(ids);

		return {
			ids,
			get: (id) => entries.get(id)!,
			find: (id) => entries.get(id),
			has: (id): id is Id => entries.has(id),
		};
	};
}
