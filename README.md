# Leviathan

A deep-sea, turn-based Roblox game built with roblox-ts. You explore freely until something notices
you, then the fight switches into BG3 / Expedition 33-style turn-based combat.

- **[docs/STRUCTURE.md](docs/STRUCTURE.md)**: project structure, conventions, and how to add
  services, controllers, components, network events, and data.
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**: the design plan for the game systems.
- **[docs/STATS.md](docs/STATS.md)**: base stat formulas and open questions.
- **[docs/COMBAT_UI.md](docs/COMBAT_UI.md)**: Combat UI requirements and inputs needed (not started).

## Stack

roblox-ts · Flamework · Zap · Charm + Charm Sync · React · ProfileStore · @rbxts/log

## Setup

Requires Node 22 and [Rokit](https://github.com/rojo-rbx/rokit).

```bash
rokit install
```

```bash
npm install
```

```bash
npm run build
```

```bash
npm run serve
```

Then connect to Rojo from Studio. Use `npm run watch` in a second terminal for live rebuilds.

## License

[MIT](./LICENSE.md)
