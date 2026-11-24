# UI assets

Exported Studio UI goes here. Nothing in this folder is synced or built yet.

## The easy way: export the GUI (no IDs needed)

In Studio, right-click each combat ScreenGui → **Save to File…** → save it here as `.rbxm`
(e.g. `combat-hud.rbxm`).

An `.rbxm` contains the full hierarchy, layout, names **and every image id**, so nothing has to be
copied by hand. Re-export and overwrite the file whenever the art changes.

## If you need a plain list of IDs

Select the UI in Studio and run `tools/studio/collect-ui-assets.luau` in the Command Bar. It writes
`ServerStorage.UiAssetIds`, a ModuleScript mapping every image and sound to its path in the UI.
Save that here as `ui-asset-ids.luau`.
