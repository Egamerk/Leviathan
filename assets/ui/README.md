# UI assets

The UI art is uploaded as images (Creator Dashboard / Asset Manager). Code never contains raw
asset ids. It uses the generated `Images` table:

```ts
import { Images } from "shared/assets/images";
<imagelabel Image={Images.Divider} />
```

## Adding or updating images

Use **Image** ids, not Decal ids: an ImageLabel can't display a Decal. Asset Manager's "Asset Type" column
shows which is which; uploading can create both. The startup log (`AssetPreloadController`) warns
when an id doesn't load.

1. Studio → **Window → Asset Manager → Images**, using the revamped Asset Manager in list view.
2. Select every image (Ctrl+A) → right-click → **Copy → Copy Info**.
3. Paste it over `assets/ui/images.csv`.
4. Run `npm run assets:images`. This regenerates `src/shared/assets/images.ts`.

Names become keys (`Wheel&Woe` → `WheelAndWoe`). A name uploaded more than once is kept as
`_v1`, `_v2`… (oldest first) and listed in `DUPLICATE_IMAGE_NAMES`. Rename or delete the extra
copies in Asset Manager to get clean keys.

## Optional: if the UI is built as GUIs in Studio

- `tools/studio/select-all-ui.luau` selects every GUI so they can all be exported as one `.rbxm`
  (right-click → Save to File…).
- `tools/studio/collect-ui-assets.luau` lists the ids used by the selected GUIs.

## Source art made here

| File                         | Asset id        | What it is                                                                                                                                                                                              |
| ---------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `source/HealthBloodTile.png` | 81895076126332  | Seamless version of `HealthBlood`: transparent ends trimmed, a baked-in vertical line softened, ends blended so it repeats with no visible join. The HUD loops it with one `ScaleType.Tile` ImageLabel. |
| `source/StaminaFill.png`     | 86227484174680  | The Stamina fill (`res`) recoloured green, so Stamina no longer looks like the purple Reservoir. Same shading and texture.                                                                              |
| `source/AuxTile.png`         | 127532014150723 | Seamless strip from the middle of the Auxiliary fill, so the orange liquid flows.                                                                                                                       |
| `source/StaminaTile.png`     | 77945278284031  | Same for the green Stamina liquid.                                                                                                                                                                      |
| `source/StaminaTileBlue.png` | 96109597399360  | The Stamina liquid in cobalt blue (replaces the green StaminaTile). Deeper than the pale Oxygen gas so the two stay distinct.                                                                           |
| `source/StaminaEmbers.png`   | 116530375623482 | AuxEmbers recoloured icy blue for the Stamina liquid (same layout, so it drifts and flickers the same way).                                                                                             |
| `source/OxygenTube.png`      | 120379759578056 | Oxygen tube in the Auxiliary/Stamina style: your Auxiliary tube with its left end mirrored for a second cap, and the even middle stretched.                                                             |
| `source/OxygenGlass.png`     | 97372734058818  | The matching glass layer (from `BackgroundAux2`, built the same way).                                                                                                                                   |
| `source/OxygenTile.png`      | 123049627159440 | Seamless pale gas for Oxygen: low-contrast mist, lighter at the top, from the Auxiliary liquid's texture.                                                                                               |
| `source/OxygenBubbles.png`   | 77723458430971  | Transparent bubbles, seamless in both directions, that rise through the gas.                                                                                                                            |
| `source/ReservoirSwirl.png`  | 90548372812692  | Vivid violet Reservoir disc with spiral arms (painted texture from the original `Woe` disc blended in), so its spin is clearly visible. If it fails to load, the dial uses the original disc.           |
| `source/AuxEmbers.png`       | 107503796492598 | Glowing embers (seamless both ways) drifting up and flickering through the Auxiliary liquid: lantern fuel.                                                                                              |
| `source/StaminaStreaks.png`  | 107649148856320 | Soft diagonal light streaks rushing through the Stamina liquid: kinetic energy.                                                                                                                         |
| `source/ReservoirRunes.png`  | 109163895968764 | Ring of glowing occult glyphs turning slowly against the Reservoir swirl.                                                                                                                               |
| `source/InventoryPanel.png`  | (upload it)     | Inventory panel background: dark slate with a double border, 256×256, 9-sliced at 16 px. The inventory picks it up automatically once it is named `InventoryPanel` in images.csv; until then it draws a plain frame. |
