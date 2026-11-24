# Project structure & conventions

This is the codebase skeleton. It contains **no gameplay**, only the framework that gameplay plugs
into. [ARCHITECTURE.md](ARCHITECTURE.md) is the design plan for the game systems that will be
built on top of it.

## Stack

| Concern | Choice | Why |
| --- | --- | --- |
| Language | roblox-ts 3 (TypeScript 5.5, pinned to the version roblox-ts bundles) | Typed Luau output |
| Framework | **Flamework** (`@flamework/core`, `@flamework/components`) | Dependency injection, ordered lifecycles, instance components. The de facto roblox-ts standard |
| Networking | **Zap** (`src/shared/network/net.zap`) | Generated, typed, buffer-serialised remotes with built-in input validation |
| State | **Charm** + **Charm Sync** | Fine-grained reactive atoms. The server replicates them to clients as delta patches |
| UI | **React** (`@rbxts/react`, `@rbxts/react-roblox`) | Declarative UI that reads the same atoms |
| Persistence | **ProfileStore** | Session-locked, auto-saving player data |
| Logging | `@rbxts/log` | Structured, levelled logs instead of `print` |
| Utilities | `@rbxts/janitor` (cleanup), `@rbxts/ripple` (UI springs), `@rbxts/t` (runtime type checks) | |
| Toolchain | Rokit (`rokit.toml`: Rojo, Zap), ESLint + Prettier, GitHub Actions CI | |

## Folder map

```
src/
├── server/                         → ServerScriptService.TS
│   ├── runtime.server.ts           entry: logger → Flamework.ignite()
│   ├── lifecycles/                 custom lifecycle interfaces (OnPlayerJoined, …)
│   ├── network/                    Zap server module (generated) + re-export
│   ├── services/                   @Service singletons, one folder per domain
│   │   ├── core/                   player-lifecycle, state-sync
│   │   └── data/                   player-data (ProfileStore)
│   ├── components/                 @Component classes bound to tagged instances (server)
│   └── store/                      server-authoritative Charm atoms
│
├── client/                         → StarterPlayerScripts.TS
│   ├── runtime.client.ts           entry: logger → Flamework.ignite()
│   ├── lifecycles/                 OnCharacterAdded, OnCharacterRemoving
│   ├── network/                    Zap client module (generated) + re-export
│   ├── controllers/                @Controller singletons, one folder per domain
│   │   └── core/                   character-lifecycle, state-sync, ui (mounts React)
│   ├── components/                 @Component classes (client)
│   ├── store/                      client atoms (synced + local)
│   └── ui/
│       ├── app.tsx                 React root; add screens here
│       ├── screens/                full-screen/HUD layers
│       ├── components/             reusable UI pieces
│       ├── hooks/                  useAtom, …
│       └── theme.ts                colours, fonts, spacing tokens
│
└── shared/                         → ReplicatedStorage.TS
    ├── config/                     tunable constants (one file per domain)
    ├── definitions/                static content registries (createRegistry)
    ├── schemas/                    data shapes: PlayerData, SyncedState
    ├── modules/                    pure, Roblox-light logic (rules, nav, …), testable
    ├── components/                 @Component classes that run on both sides
    ├── network/net.zap             network contract (source of truth)
    └── util/                       logger setup and small helpers
```

## Naming conventions

- Files are **kebab-case**. Flamework only loads files with the matching suffix
  (`Flamework.addPathsGlob` in each runtime):
  - `*.service.ts` under `server/services/`
  - `*.controller.ts` / `*.controller.tsx` under `client/controllers/`
  - `*.component.ts` / `*.component.tsx` under `*/components/`
- Classes are PascalCase and named after the file (`PlayerDataService` lives in
  `player-data.service.ts`).
- Atoms end in `Atom` (`playerDataAtom`).

The globs are resolved **at compile time**, so an empty folder never blocks startup. After adding
or removing a service/controller/component file, restart `npm run watch` (or delete
`out/tsconfig.tsbuildinfo` if Flamework reports a "dirty environment").

## How to add…

### A service (server) or controller (client)

```ts
// src/server/services/<domain>/<name>.service.ts
import { OnStart, Service } from "@flamework/core";
import type { OnPlayerDataLoaded } from "server/lifecycles";
import { PlayerDataService } from "server/services/data/player-data.service";

@Service()
export class ExampleService implements OnStart, OnPlayerDataLoaded {
	// Dependencies are constructor-injected. Never `new` a service.
	constructor(private readonly playerData: PlayerDataService) {}

	public onStart(): void {}

	public onPlayerDataLoaded(player: Player): void {}
}
```

Lifecycle order: every `onInit` (synchronous, sorted by `loadOrder`), then every `onStart`, then
`onTick` / `onPhysics` / `onRender` each frame. Built-in hooks are `OnInit`, `OnStart`, `OnTick`,
`OnPhysics` and `OnRender`. The custom hooks are:

| Side | Interface | Fired by |
| --- | --- | --- |
| Server | `OnPlayerJoined`, `OnPlayerLeaving` | `PlayerLifecycleService` |
| Server | `OnPlayerDataLoaded` | `PlayerDataService` |
| Client | `OnCharacterAdded`, `OnCharacterRemoving` | `CharacterLifecycleController` |

To add your own hook, declare an interface in `lifecycles/`, then in the owning service collect
listeners with `Modding.onListenerAdded<YourInterface>(…)` and call them. The existing lifecycle
services show the pattern.

### A component (behaviour bound to tagged instances)

```ts
// src/server/components/<name>.component.ts
import { BaseComponent, Component } from "@flamework/components";
import { OnStart } from "@flamework/core";

interface Attributes {}

@Component({ tag: "Example" })
export class ExampleComponent extends BaseComponent<Attributes, BasePart> implements OnStart {
	public onStart(): void {}
}
```

Tag an instance `Example` in Studio and Flamework constructs or destroys the component as the tag
is added or removed.

### A network event

1. Add it to `src/shared/network/net.zap` under a `── <domain> ──` header. Type client→server
   data tightly (string lengths, number ranges, enums).
2. `npm run build` (runs Zap first).
3. Use it with `import { Network } from "server/network"` (or `client/network`).

### Replicated state

1. Add a key to `shared/schemas/synced-state.ts`.
2. Server: create or update an atom in `server/store` and return a getter for the key in
   `StateSyncService.gettersFor(player)`. Only expose what that player may see.
3. Client: add an atom in `client/store` and register it under the same key in
   `StateSyncController`.
4. UI: `const value = useAtom(myAtom)`.

### Persisted player data

Add a field with a default to `shared/schemas/player-data.ts`. Existing saves get the default
through `Reconcile()`. Write it only through `PlayerDataService.update(player, fn)`, which saves
and replicates in one step. If you rename or remove a field, bump `schemaVersion` and add a
migration step in `PlayerDataService.migrate`.

Studio runs against ProfileStore's **mock** store, so play-testing never touches live data.

### Static content (abilities, enemies, items…)

Add `shared/definitions/<type>.ts` exporting `createRegistry({ ... })`, and keep behaviour in a
service or shared module that looks definitions up by id.

### Pure logic

Put anything that doesn't need Roblox instances or networking (formulas, pathfinding, the combat
rules) in `shared/modules/<domain>/`. It can then run on both server and client and be tested in
isolation.

## Commands

The `zap` and `rojo` commands need the Rokit toolchain (`rokit install`).

| Command | Does |
| --- | --- |
| `npm run build` | Zap codegen, then `rbxtsc` |
| `npm run watch` | Zap, then `rbxtsc -w` |
| `npm run serve` | `rojo serve` |
| `npm run build:place` | build + write `Leviathan.rbxlx` |
| `npm run lint` / `lint:fix` | ESLint (0 warnings allowed) |
| `npm run format` / `format:check` | Prettier |
| `npm run check` | build + lint (what CI runs, plus a format check and a place build) |
