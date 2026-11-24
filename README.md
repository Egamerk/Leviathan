# Leviathan

<<<<<<< HEAD
A deep-sea, turn-based roblox-ts game. You explore freely until something notices you, then the
fight switches into BG3 / Expedition 33-style turn-based combat on a voxelized grid, with QTE
parries, dodges, and attacks.

**Start with [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).** It explains how the pieces fit, how
the voxel navigation works, and the build order for the rest of the Trello board.

| Concern | Library |
| --- | --- |
| UI | React (`@rbxts/react`, `@rbxts/react-roblox`) |
| Client state | Charm |
| Networking | Zap (`src/shared/net/net.zap`) |
| Persistence (next) | ProfileStore |
| Validation | t |
| ECS (reserved for large world simulations) | Jecs + Planck |
=======
Minimal roblox-ts game scaffold:

| Concern | Library |
| --- | --- |
| ECS | Jecs |
| State | Charm |
| Networking | Zap |
| Scheduler | Planck |
| Data | ProfileStore |
| Validation | t |
>>>>>>> parent of 2163304 (Describe what you added or fixed)

## Layout

```
src/
<<<<<<< HEAD
  shared/
    config/    every Trello number (movement, nav, detection, combat)
    data/      abilities, enemies, status effects
    rules/     stats, initiative, damage, detection (pure functions)
    nav/       voxel grid, voxelizer, A*/Dijkstra, arena snapshot
    combat/    CombatEngine (command → events) + enemy turn AI
    net/       Zap contract + typed wrappers
  server/
    services/  nav (world grid), players (diver records)
    ai/        roaming enemies (patrol → suspicious → pursue), lighting
    encounter/ runs fights: arena, turns, QTE windows
    dev/       Studio self-tests + sandbox enemy spawner
  client/
    controllers/ movement kit, camera, encounter input/overlay, QTE input
    ui/          React HUD
    store.ts     Charm atoms
```

=======
  client/
    controllers/     # client runtime controllers
    components/      # client UI / instance components
  server/
    services/        # ProfileStore sessions and player lifecycle
    systems/         # persistence, replication, fixed-step gameplay
    components/      # server-only components
  shared/
    ecs/
      components/    # per-domain jecs components
      queries/       # reusable ECS queries
      systems/       # presentation-safe shared systems
      bus.ts         # typed system event bus
      scheduler.ts   # fixed + variable Planck schedulers
    net/             # Zap IDL, generated bindings, t validators
    state/           # server-authoritative Charm state / client mirror
    data/            # static item and ability definitions
    util/            # shared helpers
```

Gameplay systems mutate ECS and publish typed events. Persistence and
replication subscribe to those events; gameplay code never imports ProfileStore
or Zap. Persistent entities use GUIDs rather than recyclable jecs entity IDs.

>>>>>>> parent of 2163304 (Describe what you added or fixed)
## Setup

```bash
npm install
<<<<<<< HEAD
```

```bash
rokit install
```

```bash
npm run build
```

```bash
rojo serve
```

Open the place in Studio and connect Rojo. When you press Play, the output shows
`[selfTest] all nav/rules/engine checks passed`, and two test enemies spawn on the baseplate.
Walk into their view (or crouch with Ctrl to sneak up and press **E**) to start a fight.

### Combat controls

| Input | Action |
| --- | --- |
| Click a blue tile | Move (side action) |
| `1`–`4`, then click an enemy | Use that ability (main action) |
| `R` / `Enter` | Recover / End turn |
| QTE (attack) | `W`/`A`/`S`/`D` to pick a limb, Right Click for the torso |
| QTE (defense) | `F` to parry, `Q` then `A`/`S`/`D` to dodge |
| `←` `→` / mouse wheel | Rotate / zoom the tactical camera |

## Scripts

- `npm run zap`: regenerate the network code from `net.zap`
- `npm run build`: runs zap, then `rbxtsc`
- `npm run watch`: TypeScript watch mode
- `npm run build:place`: write `Leviathan.rbxlx`
=======
rokit install
npm run build
npm run build:place
rojo serve
```

Open `Leviathan.rbxlx` in Studio and connect Rojo.

## Scripts

- `npm run zap` — regenerate from `src/shared/net/net.zap`
- `npm run build` — zap + `rbxtsc`
- `npm run build:place` — write `Leviathan.rbxlx`
- `npm run watch` — TypeScript watch
>>>>>>> parent of 2163304 (Describe what you added or fixed)

## License

[MIT](./LICENSE.md)
