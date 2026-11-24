# Base stats

Source: Trello → Main Systems (Main Stats, Health, Energy Types, Universal Passives), Out of
Combat → Initiative, and Vessel → The Vessels. All numbers are in `src/shared/config/stats.ts`.

## Model

- **Five main stats:** Strength, Dexterity, Endurance, Occult, Connection.
- **Total** = allocated points + **3** in the vessel's stat. Each stat caps at **35** (the board's
  "+15 possibly" headroom is `statCapExtended = 50`).
- **Stat points** are spent with `allocateStat` (client) → `StatsService.allocate` (server). Both
  sides validate with the same `checkAllocation`. `StatsService.grantPoints` exists for Contract
  rewards.
- **Saved data:** `PlayerData.stats = { allocated, unspentPoints }` and `PlayerData.vessel`. The
  vessel bonus is computed, not stored, so changing it later never corrupts saves.
- **Everything else is derived** by the pure `deriveStats(allocated, vessel)`: on the server through
  `StatsService.getDerived(player)`, and on the client through `localStatsAtom`.

## Derived values

| Value | Formula | Card |
| --- | --- | --- |
| Max Health | 4 (armor) + 0.5 × END | Health, Main Stats |
| Max Stamina | 4 | Energy Types |
| Max Auxiliary | 2 | Energy Types |
| Max Reservoir | 6 if unlocked, else 0 | Energy Types |
| Reservoir unlocked | Depth Affinity ≥ 3, or Occultist / Apostle | Energy Types |
| Sanity | 0.75 × OCC + 0.25 × CON | Main Stats |
| Depth Affinity | 0.25 × OCC + 0.75 × CON | Main Stats |
| Parry Strength | 0.5 × STR + 0.25 × END + passives | Main Stats |
| Strength Scaling | 0.5 × DEX | Main Stats (Dexterity) |
| Dexterity Scaling | 0.5 × STR | Main Stats (Strength) |
| Dodge window | 0.15 s + 0.02 s × DEX | Main Stats |
| Stealth | 1% × DEX (capped at 90%) | Main Stats |
| Base Initiative | 5 + 0.05 × DEX (combat scales it by health) | Initiative |
| Combat move distance | 20 + 0.5 × DEX studs | Main Stats |
| Exploration speed | × (1 + 0.01 × DEX) | Main Stats |
| Ailment resist / potency | 1% × END / CON / OCC | Main Stats |

### Universal passives (`shared/definitions/stat-passives.ts`)

| Passive | Requires | Effect in stats |
| --- | --- | --- |
| Riposte | 7 DEX | unlock flag (combat will check for `"Riposte"`) |
| Resolute Will | 7 END, 7 Sanity | unlock flag (Unconscious system) |
| Iron Bulwark | 8 STR, 10 END | +3 Parry Strength, +15% parry chip reduction |

## Decisions

The cards disagreed, or didn't give a number, so these were decided. Each one is a single value in
`src/shared/config/stats.ts`, marked `DECIDED`.

**Where cards conflicted:**

| Question | Decision | Why |
| --- | --- | --- |
| Parry per Strength: 0.5 (Main Stats) or 0.75 (QTE card) | **0.5** | Main Stats is the card that defines what stats do |
| Depth Affinity to unlock Reservoir: 3 (Energy Types, Player Turn) or 5 (Universal Passives) | **3** | two cards agree, and Energy Types is the card that defines Reservoir |
| Strength raises *Dexterity* Scaling and Dexterity raises *Strength* Scaling | **kept as written** | both cards mirror each other consistently, which rewards hybrid builds |

**Numbers the board didn't give:**

| Value | Decision | At 35 (cap) |
| --- | --- | --- |
| Starting stat points | **0** (all points come from Contracts; the vessel gives +3) | n/a |
| Base dodge window | **0.15 s**, + 0.02 s per DEX | 0.85 s |
| Base combat move distance | **20 studs**, + 0.5 per DEX | 37.5 studs |
| Exploration speed | **+1%** per DEX | +35% |
| Physical / mental ailment resistance | **1%** per END / CON | 35% |
| Inflicted ailment effectiveness | **+1%** per OCC | +35% |
| Stealth cap | **90%** (a safety net; 35 DEX only reaches 35%) | n/a |

## Not included (separate systems)

- Vessel innate passives and weapons (Slipstream, Warden of the Lost Tides, …).
- Insight / loadout slots.
- Sanity tiers and armor stats.
- Character creation UI (`StatsService.setVessel` is ready for it).
- A stat allocation UI.
