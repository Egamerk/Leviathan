# UI assets

Exported Studio UI goes here. Nothing in this folder is synced or built yet.

## The easy way: export everything as one file (no IDs needed)

**Save to File** writes everything you have selected into a single `.rbxm`, so the GUIs don't need
exporting one by one.

1. Select all the GUIs at once:
   - if they're all in **StarterGui**, click the first and Shift+click the last; or
   - paste `tools/studio/select-all-ui.luau` into the Command Bar, which selects every GUI in the
     place.
2. Right-click → **Save to File…** → `assets/ui/all-ui.rbxm`.

That one file holds the full hierarchy, layout, names **and every image id**. When the art
changes, repeat the export and overwrite the file.

## If you need a plain list of IDs

Select the UI in Studio and run `tools/studio/collect-ui-assets.luau` in the Command Bar. It writes
`ServerStorage.UiAssetIds`, a ModuleScript mapping every image and sound to its path in the UI.
Save that here as `ui-asset-ids.luau`.
