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
| Dodge window | base + 0.02 s × DEX | Main Stats |
| Stealth | 1% × DEX (capped at 90%) | Main Stats |
| Base Initiative | 5 + 0.05 × DEX (combat scales it by health) | Initiative |
| Combat move distance | base + per-point × DEX | Main Stats (numbers TBD) |
| Exploration speed | 1 + per-point × DEX | Main Stats (numbers TBD) |
| Ailment resist / potency | per-point × END / CON / OCC | Main Stats (numbers TBD) |

### Universal passives (`shared/definitions/stat-passives.ts`)

| Passive | Requires | Effect in stats |
| --- | --- | --- |
| Riposte | 7 DEX | unlock flag (combat will check for `"Riposte"`) |
| Resolute Will | 7 END, 7 Sanity | unlock flag (Unconscious system) |
| Iron Bulwark | 8 STR, 10 END | +3 Parry Strength, +15% parry chip reduction |

## Needs your decision

**Conflicts between cards:**
1. **Parry per Strength:** Main Stats says **0.5**, the QTE card says **0.75**. I'm using 0.5.
2. **Reservoir unlock:** Energy Types and Player Turn say **3** Depth Affinity, while Universal
   Passives says **5**. I'm using 3.
3. **Scaling cross-over:** taken literally, Strength raises *Dexterity* Scaling and Dexterity raises
   *Strength* Scaling. I implemented it as written. Swap it if that's a typo.

**Not defined on the board yet (placeholders):**
- Starting stat points (0)
- Base dodge window (0.2 s)
- Base combat move distance (20 studs) and studs per DEX (1)
- Exploration speed per DEX (1%)
- Ailment resistance and potency per point (1%)

## Not included (separate systems)

- Vessel innate passives and weapons (Slipstream, Warden of the Lost Tides, …).
- Insight / loadout slots.
- Sanity tiers and armor stats.
- Character creation UI (`StatsService.setVessel` is ready for it).
- A stat allocation UI.
