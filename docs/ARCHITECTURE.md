# Leviathan architecture (proposal)

This is a plan for structuring the game: exploring, getting noticed and chased, then switching
into a turn-based fight on a voxelized grid (BG3 / Expedition 33 style). It ends with a build
order for the rest of the Trello board.

`src/` doesn't contain any of this yet. File paths below show where each piece is **planned** to
live. A prototype of the whole plan is in
[`reference/implementation/src/`](../reference/implementation/) if you want to see one way of
writing it. That copy isn't part of the build, so read from it or copy out of it as you like.

---

## 1. The one idea everything hangs on

**Rules are pure data and functions. Roblox is just the input/output.**

```
             ┌──────────────────────── shared/ (no Players, no remotes) ───────────────────────┐
             │  config/   tunables from Trello        data/   abilities, enemies, statuses       │
             │  rules/    stats, initiative,          nav/    voxel grid, A*, Dijkstra,          │
             │            damage, detection                   voxelizer, arena snapshot          │
             │  combat/   CombatEngine (command → events state machine) + enemy turn AI          │
             └────────────────────────────────────────────────────────────────────────────────┘
                   ▲ used by                                          ▲ used by
┌──────────── server/ (authority) ────────────┐        ┌──────────── client/ (presentation) ─────────────┐
│ services/nav       world grid, lazy bake     │  Zap   │ controllers/movement  Trello movement kit        │
│ services/players   diver records, stance     │◄──────►│ controllers/camera    free cam ↔ tactical cam    │
│ ai/enemyService    patrol→suspect→pursue     │        │ controllers/encounter state mirror, move range,  │
│ encounter/…        runs CombatEngine,        │        │                       click → command            │
│                    QTE windows, animation    │        │ controllers/qte       parry/dodge/attack input   │
└──────────────────────────────────────────────┘        │ ui/ (React + Charm)   HUD                        │
                                                        └──────────────────────────────────────────────────┘
```

Why this layout suits a turn-based game:

- **You can test it.** If `CombatEngine` and the pathfinder never touch `Players`, remotes, or
  time, a self-test (planned as `server/dev/selfTest.ts`) can run whole fights in milliseconds,
  in Studio or headless under Lune.
- **One rules path.** Players and the AI both send the same `CombatCommand`s through
  `engine.apply()`, so the AI can't break rules the player has to follow.
- **The server is the authority.** Clients only send intents (`Move to node`, `UseAbility on
  target`, QTE presses with timestamps). The server validates them and broadcasts `CombatEvent`s.
- **Events drive the presentation.** The client never guesses at outcomes. It plays the events it
  receives, so animations, VFX, and UI can all change without touching the rules.

---

## 2. Game flow (per diver)

```
 ┌──────────┐  enemy suspicion ≥ 1   ┌───────────┐  within engageRange   ┌──────────────┐
 │ Explore  │ ─────────────────────► │ Pursued   │ ────────────────────► │ Encounter    │
 │ (free    │ ◄───────────────────── │ (enemy    │                       │ starting     │
 │  roam)   │   lost sight 6 s       │  A* chase)│   diver presses E on  │ bake+snapshot│
 └──────────┘                        └───────────┘   an unaware enemy ──►│ snap to tiles│
      ▲                                                                  └──────┬───────┘
      │ encounterEnded (win)                                                    ▼
      │                                                                  ┌──────────────┐
      └───────────────────────────── Down (unconscious) ◄──── lose ───── │ Combat       │
                                                                         │ (turn based) │
                                                                         └──────────────┘
```

| Trello rule | Where it lives |
| --- | --- |
| Head-on / Diver stealth / Enemy ambush encounters | `rules/detection.ts → classifyEnemyEngage`, `enemyService` (engageEnemy) |
| +25% / −50% initiative, ambusher acts twice | `rules/initiative.ts → buildTurnOrder` |
| Initiative = 5 × health% + 0.05 × Dex, rebuilt each round | `rules/initiative.ts`, `CombatEngine.newRound` |
| 1 Main + 1 Side action per turn | `CombatEngine` (`turn.mainUsed / sideUsed`) |
| Move distance from Dexterity (+ hidden Speed for enemies) | `rules/stats.ts → moveStuds` |
| Melee auto-step without spending Move | `CombatEngine.autoStep` |
| Can't move too close to an enemy | `CombatConfig.personalSpace` |
| Recover: +2 Stamina, +3 Health, +1 Reservoir | `CombatEngine.onRecover` |
| Stamina +1 per turn | `CombatEngine.beginTurn` |
| Defense / Armor Pierce | `rules/damage.ts → applyDefense` |
| Parry Strength thresholds (33% / 100%) | `rules/damage.ts → resolveParry` |
| Dodge directions A/S/D | `AbilityDef.dodge`, `CombatEngine.onDefense` |
| Bleed → Hemorrhage → Exsanguination | `data/statuses.ts` |
| Unconscious at 0 HP, implode on overkill | `CombatEngine.damage` |
| +1 Auxiliary when a battle ends | `encounterService.finish` |
| Crouch shrinks detection, +1% stealth per Dex | `rules/detection.ts`, `DetectionConfig` |
| Sprint / dash / wall climb / wall bounce / swim dash / descend / crouch | `client/controllers/movement.ts` |

---

## 3. Voxel navigation (the walkable-ground problem)

### Data structure: a "2.5D" voxel grid

A full 3D voxel grid is wasteful because characters only ever stand on surfaces. So we store
**columns**. The world is split into `cellSize` (2-stud) squares, and each column keeps up to
`maxLayers` walkable floor heights:

```
  side view of one column           top view (cells)
                                    ┌──┬──┬──┬──┐
   ███████  ← bridge  (layer 1)     │  │▓▓│  │  │  ▓▓ = no floor (wall / pit)
                                    ├──┼──┼──┼──┤
   ░░░░░░░  ← canyon  (layer 0)     │  │▓▓│  │  │  every other cell = 1..4 floors
```

A **node** is one `(x, z, layer)` triple packed into a single number, so the hash maps stay cheap.
Neighbours are 8-connected. You can only step to an adjacent floor within `maxStepHeight`, and
you can't cut diagonally past a wall corner. Edge costs are 3D stud distances, so "you can move
26 studs this turn" means what it says.

### Baking (`shared/nav/voxelizer.ts`)

For each cell centre:

1. Raycast straight down from the ceiling.
2. If the hit surface is flatter than `maxSlopeDegrees`, it's a candidate floor.
3. Test the space above it with `GetPartBoundsInBox(agentHeight × agentDiameter)`. Anything in
   that box (a wall, a low ceiling, a crate) disqualifies the cell. The box is wider than a cell,
   which also erodes cells next to walls by `agentRadius`, so models don't clip into walls.
4. Keep casting below the hit to find more floors (caves, under bridges).

`server/services/nav.ts` bakes in **16×16-cell chunks**, either lazily (the first time a pursuit
or encounter needs them) or ahead of time for parts tagged `NavVolume`. It yields between chunks
to keep frame times smooth. Call `invalidate(center, radius)` after geometry changes (doors,
collapses).

### Using the same grid in both modes

| Mode | Algorithm | File |
| --- | --- | --- |
| Roaming pursuit | A* (`allowPartial` so chasers still close in) + string-pull smoothing | `pathfinder.findPath`, `smoothPath` |
| Combat move range | Dijkstra flood fill bounded by `moveStuds` | `pathfinder.reachable` |
| Combat move validation | O(1) lookup in that flood fill | `CombatEngine.onMove` |
| AI approach | best reachable tile toward the nearest diver | `combat/ai.ts` |
| Melee auto-step | budget-capped A* | `CombatEngine.autoStep` |

### Arena snapshots

When a fight starts, the server cuts a square around the encounter (`arenaRadius`) out of the
world grid and packs it into a `buffer` (`nav/snapshot.ts`), then sends it once in
`encounterStarted`. **The server then fights on the restored copy too**, so the client's blue
move-range tiles come from the same f32 data and the same Dijkstra the server validates against.
That rules out "the client showed it but the server said no" drift.

Combatants block their tiles (`grid.block`). A* may still target a blocked tile, and stops beside
it, which is what attacks need.

---

## 4. Detection → pursuit

`ai/enemyService.ts` ticks every roaming enemy 10× per second:

- **Suspicion meter**. `rules/detection.suspicionRate` combines distance, FOV, line of sight
  (raycast), crouch, Dex stealth, and the **light level at the diver** (`ai/lighting.ts`, so a
  lantern makes you easier to see). Proximity gets noticed regardless of facing.
- **Idle → Suspicious** (turns to look, and the client shows a fading **?**) → **Pursuing**
  (faster WalkSpeed, re-paths every 0.5 s, client shows **!**) → **Engage** inside
  `engageRange`.
- On engage, `classifyEnemyEngage` picks HeadOn or EnemyAmbush from the diver's facing and the
  light level. If a diver presses **E** next to an *Idle* enemy, the fight starts as a
  DiverStealth encounter.

Path requests run in their own threads, so a lazy chunk bake never stalls the AI loop. Enemy
roots are server-owned, so clients can't spoof a pursuer's position.

---

## 5. A turn, end to end

```
client                       server (encounterService)                 CombatEngine
──────                       ─────────────────────────                 ────────────
click enemy  ─combatCommand─► apply(UseAbility)  ───────────────────────► validate, pay cost,
                                                                          auto-step, emit
                                                ◄─────── events ───────── AbilityStarted,
◄──────── combatEvents ───── replicate + animate                          AwaitAttackQte
◄──────── qteWindow ──────── open window (shared clock)
press W     ─qteInput──────► judge timing → apply(ResolveAttackQte) ────► damage × QTE mult
                                                                          target is a player?
◄──────── qteWindow ──────── open Defense window  ◄─── AwaitDefense ──────┘
press F     ─qteInput──────► judge → apply(ResolveDefense{Parry}) ──────► resolveParry → Damaged
◄──────── combatEvents ─────                                               …EncounterEnded
```

- Times use `workspace:GetServerTimeNow()` on both sides. The server clamps the client's claimed
  press time to "no later than received" and adds `qteLatencyGrace`.
- If no input arrives before the window closes, a timeout resolves the QTE as a miss. A turn timer
  (`turnTimeout`) ends idle turns.
- The engine **pauses** on `pending` (AttackQte / Defense) and rejects anything else until it's
  resolved. New QTE minigames (Thread Weave, OSU) only change the *client* widget and the server's
  success test. The engine just receives `success` and a `limb`.

---

## 6. Networking (Zap)

`src/shared/net/net.zap` is the contract. `npm run zap` generates Luau and `.d.ts` files, and
`shared/net/{server,client}.ts` import the generated types, so the TypeScript types can't drift
from the contract.

| Event | Dir | Notes |
| --- | --- | --- |
| `setStance` | C→S | crouch/sprint flags for detection |
| `engageEnemy` | C→S | diver stealth initiation (range-checked) |
| `awareness` | S→C | unreliable, suspicion meter |
| `encounterStarted` | S→C | arena buffer + combatant views + model refs |
| `combatEvents` | S→C | `unknown` batch mirroring `CombatEvent` (trusted, low frequency) |
| `combatCommand` | C→S | tagged enum: Move / UseAbility / Recover / EndTurn |
| `qteWindow` / `qteInput` | S↔C | window timing / first input + timestamp |
| `encounterEnded` | S→C | winner |

Client→server messages are strictly typed so Zap rejects malformed input before gameplay code
sees it.

---

## 7. Level-design hooks

| What | How |
| --- | --- |
| Pre-bake a combat area | Box part tagged **`NavVolume`**, `CanCollide = false`, `Transparency = 1` |
| Make something invisible to nav (foliage, VFX) | Tag **`NavIgnore`**, or set `CanCollide = false` |
| Invisible wall that's never walkable | Tag **`NavBlocker`** |
| Enemy spawn | Part tagged **`EnemySpawn`** with a string attribute **`EnemyId`** (`Drifter`, `SeaScorn`) |
| Real enemy model | `ServerStorage.Enemies.<EnemyId>`: a Model with a `Humanoid` and `HumanoidRootPart` |
| Light that affects stealth | Any `PointLight` / `SpotLight` / `SurfaceLight` (lanterns included) |

A Studio-only sandbox script (planned as `server/dev/sandbox.ts`) should drop a couple of test
enemies on the baseplate when the place has no `EnemySpawn` parts, so the loop can be tested right
away.

---

## 8. Build order (mapped to the Trello "V.1.0 Playable State" card)

**Phase 0: foundation (build these first, roughly in this order)**
1. `shared/config` + `shared/rules`: Trello numbers and pure formulas (stats, initiative,
   damage, detection).
2. `shared/nav`: grid, A*/Dijkstra, then the raycast voxelizer, then the arena snapshot. Test it
   on a hand-made grid before touching raycasts.
3. `shared/combat`: the engine (move, a basic strike, recover, end turn), then the pending
   QTE steps, then a simple enemy turn AI.
4. `net.zap`, then the server encounter service, then the client mirror and move-range overlay.
5. Roaming enemies (detection → pursuit → engage) and the client movement kit.
6. A placeholder HUD, just enough to prove that events reach the UI.

**Phase 1: make the existing loop feel good**
1. *Intro animation for battles*: hook `encounterStarted` (camera swoop, arena ring VFX).
2. *Animations for everything*: drive them from `CombatEvent`s with a client-side queue so each
   event's animation finishes before the next one plays. Move `animateMove` off the server and
   into this queue too.
3. *Combat UI incl. QTE minigames*: replace `ui/App.tsx` piece by piece. Add a widget per
   `AttackQteKind` (Basic WASD strings with multiple stages, Target Hit, Thread Weave, OSU).
4. *Parry/Dodge systems*: tune windows. Add Riposte (side action, needs 7 Dex) as a third pending
   step.

**Phase 2: data + persistence**
5. *Base stats / character creation*: `DiverRecord` in `services/players.ts` is the seam for
   ProfileStore (already a dependency). Save stats, loadout, and resources. Permadeath wipes the
   slot.
6. *Skills / Insight / Loadout slots*: new `AbilityDef`s plus a loadout validator. Skills are just
   data rows.
7. *Limbs (enemy & player)*: `limb` already flows through `Damaged`. Add per-limb HP and effects
   in the engine.
8. *Bone Charms / Brands*: passive modifiers. Add a hook table (onTurnStart, modifyDamage, …)
   called from the engine the way statuses are.

**Phase 3: the world**
9. *Oxygen system + UI, Depths gauge*: a server tick that only runs during `Explore`. Unconscious
   oxygen drain fits into the existing `Down` phase.
10. *Auxiliary/Equipment, Harvesting/Interacting, Inventory UI*: a `Utility` main action that
    costs Auxiliary.
11. *Reservoir + Rituals*: the side action `Ritual` and ritual casting (the OSU minigame).
12. *Diving bell, reserve lives, extraction*: they hook into `Down` and `encounterService.finish`.
13. *Dialogue/NPCs*: independent of combat.

**When to bring in jecs/planck (already in `package.json`)**: once there are hundreds of ticking
world objects (harvestables, hazards like Blood Coral, ambient fish, oxygen ticks). The turn-based
core doesn't need an ECS, and keeping it out of the engine keeps the engine testable.

---

## 9. Trello rules that need a decision (they'd live in `shared/config`)

- **Parry 33–100%.** The card's wording is ambiguous. I went with: < 33% means your block
  shatters and you're staggered; 33–99% means your block shatters and you take the full hit;
  ≥ 100% is a full parry.
- **Parry Strength formula.** The QTE card says Str × 0.75 + End × 0.25. The Main Stats card says
  Str × 0.5 + End × 0.25. I used the QTE card's numbers (`CombatConfig.parryPerStrength`).
- **Implosion.** I read "Taking damage 20%> than your maximum health" as a single hit of at least
  1.2 × max HP.
- **Damage scaling.** No formula is defined yet, so it's `base + stat × ratio × 0.1`
  (`SCALING_UNIT`).
- **Enemy dodge/parry chances.** These are simple linear placeholders in `rules/damage.ts`.
- **Scale mismatch.** Diver health starts at 4, but the enemy template card has 45 HP. The sample
  enemies use 6–12 HP so fights end in a few rounds.
- **Downed divers.** Until Vials, Rituals, and extraction exist, a placeholder should wake them up
  (the prototype wakes them at 40% after 15 s).

---

## 10. Recommended packages

| Need | Package |
| --- | --- |
| UI | `@rbxts/react`, `@rbxts/react-roblox` |
| Client state | `@rbxts/charm` (already installed) |
| Networking | Zap (already in `rokit.toml`) |
| Persistence | `@rbxts/profile-store` (already installed) |
| Cleanup of connections/instances | `@rbxts/janitor` |
| UI springs/animation | `@rbxts/ripple` |
| Large world simulations later | `@rbxts/jecs` + `@rbxts/planck` (already installed) |
| Headless tests | Lune, running the compiled shared modules |
