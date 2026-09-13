# Leviathan

Minimal roblox-ts game scaffold:

| Concern | Library |
| --- | --- |
| ECS | Jecs |
| State | Charm |
| Networking | Zap |
| Scheduler | Planck |
| Data | ProfileStore |
| Validation | t |

## Layout

```
src/
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

## Setup

```bash
npm install
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

## License

[MIT](./LICENSE.md)
