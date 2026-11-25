# UI assets

The UI art is uploaded as images (Creator Dashboard / Asset Manager). Code never contains raw
asset ids. It uses the generated `Images` table:

```ts
import { Images } from "shared/assets/images";
<imagelabel Image={Images.Divider} />
```

## Adding or updating images

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

| File | Asset id | What it is |
| --- | --- | --- |
| `source/HealthBloodTile.png` | 81895076126332 | Seamless version of `HealthBlood`: transparent ends trimmed, a baked-in vertical line softened, ends blended so it repeats with no visible join. The HUD loops it with one `ScaleType.Tile` ImageLabel. |
| `source/StaminaFill.png` | 86227484174680 | The Stamina fill (`res`) recoloured green, so Stamina no longer looks like the purple Reservoir. Same shading and texture. |
| `source/AuxTile.png` | **upload needed** | Seamless strip from the middle of the Auxiliary fill, so the orange liquid can flow. Once uploaded: add it to `images.csv` as `AuxTile`, run `npm run assets:images`, set `HudArt.auxiliary.flowTile = Images.AuxTile`. |
| `source/StaminaTile.png` | **upload needed** | Same for the green Stamina liquid: add it as `StaminaTile`, set `HudArt.stamina.flowTile = Images.StaminaTile`. |
