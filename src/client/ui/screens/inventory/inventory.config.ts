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

/**
 * A tile border image and where its pieces are (pixels of the uploaded art, which is square).
 * The tile draws the corners and the middle connector at a fixed boldness and stretches only
 * the plain lines between them, so the border keeps its look at any tile size.
 */
export interface FrameArt {
	image: string;
	/** Art width = height. */
	size: number;
	/** Corner ornament extent from each edge. */
	corner: number;
	/** Middle connector span along each edge. */
	middleStart: number;
	middleEnd: number;
	/** Inner edge of the border band from each edge (the colour fills inside this). */
	inner: number;
}

/** Plain frame (CommonItem). Measured from the uploaded 465×465 art. */
export const CommonFrame: FrameArt = {
	image: Images.CommonItem,
	size: 465,
	corner: 45,
	middleStart: 212,
	middleEnd: 253,
	inner: 25,
};

/** Ornate frame (RareItem). */
export const RareFrame: FrameArt = {
	image: Images.RareItem,
	size: 465,
	corner: 80,
	middleStart: 212,
	middleEnd: 253,
	inner: 25,
};

/**
 * Border boldness: on-screen pixels per art pixel, per pixel of tile size.
 * 0.004 → an 80 px tile draws the art at 0.32×, a border band about 4–5 px thick.
 */
export const FRAME_BOLDNESS = 0.004;

export interface RarityStyle {
	/** Border art drawn over the coloured background (its centre is transparent). */
	frame: FrameArt;
	/** Tile background behind the frame. */
	color: Color3;
	/** Colour of the name written on the tile. */
	text: Color3;
}

/** Common items use the plain frame; every other rarity uses the ornate one. */
export const Rarities: Record<string, RarityStyle> = {
	Common: { frame: CommonFrame, color: Color3.fromRGB(214, 203, 158), text: Color3.fromRGB(58, 50, 36) },
	Uncommon: { frame: CommonFrame, color: Color3.fromRGB(186, 196, 214), text: Color3.fromRGB(40, 44, 58) },
	Rare: { frame: RareFrame, color: Color3.fromRGB(196, 186, 222), text: Color3.fromRGB(46, 38, 66) },
	Epic: { frame: RareFrame, color: Color3.fromRGB(226, 182, 160), text: Color3.fromRGB(70, 38, 28) },
	Legendary: { frame: RareFrame, color: Color3.fromRGB(232, 206, 120), text: Color3.fromRGB(70, 50, 14) },
};

export const DEFAULT_RARITY = "Common";

export const HotbarConfig = {
	/** Number of hotbar slots (keys 1–9, then 0). */
	slots: 10,
	/** Slot size as a fraction of screen height (slots are square). */
	slotSize: 0.07,
	/** Gap between slots, as a fraction of a slot. */
	gap: 0.1,
	/** Bottom of the hotbar, as a fraction of screen height from the bottom (under the vitals HUD). */
	bottom: 0.015,
	/** How far the equipped slot rises, as a fraction of a slot. */
	equippedLift: 0.12,
} as const;

export const InventoryConfig = {
	toggleKey: Enum.KeyCode.Backquote,
	/** Panel width as a fraction of screen height, so it keeps its shape on any aspect. */
	width: 0.7,
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
	panelColor: Color3.fromRGB(78, 88, 96),
	panelTransparency: 0.2,
	/** Inset box that holds a group of tiles. */
	groupColor: Color3.fromRGB(44, 50, 56),
	groupTransparency: 0.35,
	groupEdge: Color3.fromRGB(128, 136, 142),
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
