# Combat UI: reference (not started)

Requirements gathered from the Trello board for when Combat UI work begins. **Nothing here is
implemented yet.** Items marked **TBD** are open questions to answer first.

## Inputs needed before starting

| Item | Status |
| --- | --- |
| Combat ScreenGui(s) exported as `.rbxm` into `assets/ui/` (see [assets/ui/README.md](../assets/ui/README.md)) | **TBD** |
| Screenshot or note per state: your turn, enemy turn, targeting, each QTE | **TBD** |
| Which QTE minigames have finished art (table below) | **TBD** |
| Whether the action menu layout matches the Trello turn structure | **TBD** |
| Target selection: click the enemy in the world, or pick from a list | **TBD** |
| Scope: build the UI against a mock combat state first, or the turn engine first | **TBD** |

Plan: keep the art exactly as built in Studio and bind behaviour to the exported instances by
name, rather than rebuilding the layout in code.

## Turn structure (Trello: Combat → Player Turn)

Each turn has **1 Main action** and **1 Side action**.

| Main actions | Notes |
| --- | --- |
| Attack | physical attacks; costs **Stamina** |
| Ritual Cast | needs Reservoir (`DerivedStats.hasReservoir`); costs **Reservoir** |
| Utility | Equipment items; costs **Auxiliary** |
| Recover | skip the turn: +2 Stamina, +3 Health, +1 Reservoir |

| Side actions | Notes |
| --- | --- |
| Move | distance from Dexterity (`DerivedStats.combatMoveStuds`); a melee basic attack auto-steps without using Move |
| Ritual | needs 3 Depth Affinity or Occultist/Apostle; non-damaging, has a toll |
| Riposte | needs the `"Riposte"` passive (7 DEX); stance that counters after a successful evade, and +20% damage taken if the evade fails |
| Nothing | skip the side action |

The HUD also needs Health, Stamina, Reservoir (only when unlocked) and Auxiliary from
`DerivedStats`, plus the turn order (initiative).

## QTE minigames (Trello: Quick Time Events, QTE Types)

| QTE | Used for | Input | Art? |
| --- | --- | --- | --- |
| Basic Attack | the always-equipped Strike | WASD direction strings, one stage at a time; no input hits the torso | **TBD** |
| Target Hit | attacks | Right Click (or a QTE keybind) just after impact; brief frames after the hit, none before | **TBD** |
| Thread Weave | skills | follow a half-drawn thread, press a QTE keybind or RMB where the threads meet; speeds up | **TBD** |
| "OSU" | mostly ritual casts | click the starting sigil, follow the lines, hit closing off-beats with RMB or a keybind | **TBD** |
| Parry | defense | F before the hit; strength check (≥ 100% full parry, < 33% stagger) | **TBD** |
| Dodge | defense | Q then A (left) / S (lean back) / D (right), matching the attack direction | **TBD** |
| Steady Heartbeat | Unconscious | Left / Right Click for lines from the left / right | **TBD** |
| Steady Breathing | Unconscious | Space when the pulse reaches the heart; tempo rises as oxygen drops | **TBD** |

- **QTE keybinds:** four rebindable keys, default **Z X C V**. They're active only during a QTE,
  so double-binding them is allowed.
- **Timing:** the server owns the windows, using the shared clock `workspace:GetServerTimeNow()`.
  The UI only displays them and reports input with a timestamp (see ARCHITECTURE.md §5).
- **Stat hooks:** the dodge window comes from `DerivedStats.dodgeWindowSeconds` and parry strength
  from `DerivedStats.parryStrength`.
- **Resolute Will** (`"ResoluteWill"` passive) removes one of the Unconscious QTEs.

## Where it will live (per STRUCTURE.md)

```
client/controllers/combat/        combat-ui.controller.ts, qte.controller.ts
client/ui/screens/combat/         HUD, action menu, turn order, target picker
client/ui/components/qte/         one component per QTE type
client/store/combat.ts            combat view state (atoms)
```
