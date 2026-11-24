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

| File | What it is | To use it |
| --- | --- | --- |
| `source/HealthBloodTile.png` | Seamless version of `HealthBlood`: transparent ends trimmed, a baked-in vertical line softened, ends blended so it repeats with no visible join | Upload it as an Image, add the row to `images.csv` (name `HealthBloodTile`), run `npm run assets:images`, then set `HudArt.health.bloodTile = Images.HealthBloodTile` in `src/client/ui/screens/hud/hud.config.ts` |
