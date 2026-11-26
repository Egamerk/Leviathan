import { Images } from "shared/assets/images";

/**
 * Hotbar + inventory look and controls.
 *
 * A Tool's look comes from attributes set on the Tool instance:
 *   - `Rarity`   (string)  key of `Rarities` below. Missing → "Common".
 *   - `Color`    (Color3)  overrides the rarity's background colour.
 *   - `Quantity` (number)  shows a count badge (stacks, charges…).
 * A Tool with a `TextureId` shows that icon; otherwise its name is written on the tile.
 */

export interface RarityStyle {
	/** Border art drawn over the coloured background (its centre is transparent). */
	frame: string;
	/** Tile background behind the frame. */
	color: Color3;
	/** Colour of the name written on the tile. */
	text: Color3;
}

/** Common items use the plain frame; every other rarity uses the ornate one. */
export const Rarities: Record<string, RarityStyle> = {
	Common: { frame: Images.CommonItem, color: Color3.fromRGB(214, 203, 158), text: Color3.fromRGB(58, 50, 36) },
	Uncommon: { frame: Images.CommonItem, color: Color3.fromRGB(186, 196, 214), text: Color3.fromRGB(40, 44, 58) },
	Rare: { frame: Images.RareItem, color: Color3.fromRGB(196, 186, 222), text: Color3.fromRGB(46, 38, 66) },
	Epic: { frame: Images.RareItem, color: Color3.fromRGB(226, 182, 160), text: Color3.fromRGB(70, 38, 28) },
	Legendary: { frame: Images.RareItem, color: Color3.fromRGB(232, 206, 120), text: Color3.fromRGB(70, 50, 14) },
};

export const DEFAULT_RARITY = "Common";

export const HotbarConfig = {
	/** Number of hotbar slots (keys 1–9, then 0). */
	slots: 10,
	/** Slot size as a fraction of screen height (slots are square). */
	slotSize: 0.068,
	/** Gap between slots, as a fraction of a slot. */
	gap: 0.1,
	/** Bottom of the hotbar, as a fraction of screen height from the bottom (sits above the vitals HUD). */
	bottom: 0.245,
	/** How far the equipped slot rises, as a fraction of a slot. */
	equippedLift: 0.12,
} as const;

export const InventoryConfig = {
	toggleKey: Enum.KeyCode.Backquote,
	/** Panel width as a fraction of screen height, so it keeps its shape on any aspect. */
	width: 0.62,
	/** Panel top / bottom as fractions of screen height. */
	top: 0.04,
	bottom: 0.04,
	left: 0.012,
	/** Tile size as a fraction of screen height. */
	tileSize: 0.06,
	/**
	 * Panel background, 9-sliced. Uses the uploaded `InventoryPanel` image once it is in
	 * images.csv (art: assets/ui/source/InventoryPanel.png); until then a plain frame.
	 */
	panelImage: (Images as unknown as Record<string, string | undefined>)["InventoryPanel"],
	/** Slice centre of InventoryPanel.png (256×256). */
	panelSlice: new Rect(16, 16, 240, 240),
	panelColor: Color3.fromRGB(56, 63, 70),
	panelTransparency: 0.12,
	headerText: Color3.fromRGB(222, 226, 228),
	mutedText: Color3.fromRGB(150, 158, 164),
	divider: Color3.fromRGB(110, 118, 126),
} as const;

export const InventoryFonts = {
	/** Serif, like the reference. */
	title: new Font("rbxasset://fonts/families/Merriweather.json", Enum.FontWeight.Regular),
	tile: new Font("rbxasset://fonts/families/Merriweather.json", Enum.FontWeight.Regular),
	small: new Font("rbxasset://fonts/families/Merriweather.json", Enum.FontWeight.Bold),
} as const;

export function rarityOf(tool: Tool): RarityStyle {
	const rarity = tool.GetAttribute("Rarity");
	return (typeIs(rarity, "string") ? Rarities[rarity] : undefined) ?? Rarities[DEFAULT_RARITY];
}
