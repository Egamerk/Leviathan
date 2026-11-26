# Lighting

Presets in `src/shared/config/lighting.ts`; applied by `client/controllers/world/lighting.controller.ts`.

| Preset               | Area                 | Look                                                                                                                       |
| -------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `Corridor` (default) | industrial corridors | near-black ambient so the caged lamps carry the scene; warm haze; glow around lamps; warm, slightly desaturated grade      |
| `Cathedral`          | gothic halls         | cold blue key light with light shafts through the windows; deep blue shadows; pale-blue haze; glow on windows and lanterns |

## Zones

1. Add a Part covering the area (Anchored, CanCollide/CanQuery/CanTouch off, Transparency 1).
2. Tag it `LightingZone` (Properties → Tags, or the Tag Editor).
3. Give it a string attribute `Preset` = `Cathedral` (or another preset name).
4. Optional number attribute `Priority` for overlapping zones (higher wins).

Outside every zone the default preset applies. Moving between zones blends over 1.6 s
(`LightingBlendSeconds`).

## Testing

- Studio chat: `/lighting cathedral`, `/lighting corridor`, `/lighting off` (back to zones).
- Or set the Workspace attribute `LightingPreset` while playing.

## Notes

- `Lighting.Technology` is set to **Future** in `default.project.json`. The lamps need it for
  real point-light shadows. Roblox may not let Rojo change it while syncing: if Properties →
  Lighting → Technology isn't `Future`, set it there once (it's saved with the place).
- The controller owns one Atmosphere and its own `Leviathan_*` post effects. Existing
  ColorCorrection / Bloom / SunRays / DepthOfField effects under Lighting are disabled while
  playing (not deleted) so they don't stack.
- Light shafts come from the sun's direction: tune `ClockTime` and `GeographicLatitude` in the
  `Cathedral` preset so they come through your windows.
- Add a preset by copying one in `LightingPresets`; its key is the name used in zones.
