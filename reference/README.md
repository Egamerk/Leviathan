# Reference implementation (not built)

`implementation/src/` is a complete first prototype of the plan in
[`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md). It covers voxel nav, detection and pursuit,
encounters, the turn engine, QTEs, the movement kit, and a placeholder HUD.

It sits **outside** `src/`, so roblox-ts, Rojo, and ESLint all ignore it. It's here so you can
read it or copy pieces into `src/` as you build the architecture yourself.

If you copy files back, you'll need the packages it uses (`@rbxts/react`, `@rbxts/react-roblox`,
`@rbxts/janitor`, `@rbxts/charm` ≥ 0.11.1). It was last verified to compile, lint, and pass its
self-tests at commit `df84d21`.
