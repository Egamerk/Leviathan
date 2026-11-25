import { Images } from "shared/assets/images";

/**
 * Vitals HUD layout.
 *
 * Positions are in **health widths** (hw), measured from the centre of the
 * health capsule (y grows downward). Each piece's height follows its art's
 * real aspect ratio, so nothing stretches, letterboxes or misaligns at any
 * resolution. `hud.layout.ts` turns this into Roblox UDim2s inside one
 * cluster frame anchored to the bottom-centre of the screen.
 *
 * The arrangement is the Studio design, with an equal gap above and below the
 * health capsule, and the Reservoir dial made concentric from measured art.
 */

/** Width ÷ height of each image (from the uploaded art). */
export const ArtAspect = {
	health: 420 / 26,
	oxygen: 420 / 14,
	resourceBar: 420 / 57,
	holder: 420 / 191,
	wheel: 420 / 258,
	core: 420 / 417,
	divider: 420 / 39,
} as const;

/** Gap between the health capsule and the rows above/below it (hw). */
const GAP = 0.016;
const HEALTH_HALF = 1 / ArtAspect.health / 2;
/** Oxygen is secondary, so it's a little shorter than health. */
const OXYGEN_WIDTH = 0.82;
const OXYGEN_HALF = OXYGEN_WIDTH / ArtAspect.oxygen / 2;
const BAR_WIDTH = 0.375;
const BAR_HALF = BAR_WIDTH / ArtAspect.resourceBar / 2;

/**
 * Reservoir dial geometry, measured from the art (pixels in each image at
 * 420 px wide). Used to make the three pieces concentric: the purple core
 * fills the holder's hole, and the brass ring sits on the hole's bevelled rim.
 */
const Dial = {
	holderWidth: 0.3,
	/** Holder (Wheel&Woe1): the hole's centre and radius, and the outer edge of its bevelled rim. */
	holeCenter: new Vector2(211, 42),
	holeRadius: 78,
	bevelRadius: 95,
	/** Wheel: the brass ring's centre and its inner/outer radius. */
	ringCenter: new Vector2(210, 44.6),
	ringInner: 95,
	ringOuter: 112,
	/** Woe (purple core): the disc's radius (centred in its image). */
	discRadius: 193.4,
	/** How far (art px) the disc extends under the ring's inner edge. */
	discTuck: 2,
	/** How far (hw) the holder's top tucks under the health capsule. */
	tuck: 0.003,
} as const;

const ART_WIDTH = 420;
const holderScale = Dial.holderWidth / ART_WIDTH;
const holderTop = HEALTH_HALF - Dial.tuck;
const holeX = (Dial.holeCenter.X - ART_WIDTH / 2) * holderScale;
const holeY = holderTop + Dial.holeCenter.Y * holderScale;
const wheelWidth = Dial.holderWidth * (Dial.bevelRadius / Dial.ringOuter);
const wheelScale = wheelWidth / ART_WIDTH;
const coreWidth = (Dial.ringInner * wheelScale + Dial.discTuck * holderScale) * (ART_WIDTH / Dial.discRadius);

export interface Piece {
	/** Centre x / y in hw from the health capsule's centre. */
	x: number;
	y: number;
	/** Width in hw; height = width / aspect. */
	width: number;
	aspect: number;
}

export const HudPieces = {
	oxygen: { x: 0, y: -(HEALTH_HALF + GAP + OXYGEN_HALF), width: OXYGEN_WIDTH, aspect: ArtAspect.oxygen },
	health: { x: 0, y: 0, width: 1, aspect: ArtAspect.health },
	auxiliary: { x: -0.3, y: HEALTH_HALF + GAP + BAR_HALF, width: BAR_WIDTH, aspect: ArtAspect.resourceBar },
	stamina: { x: 0.3, y: HEALTH_HALF + GAP + BAR_HALF, width: BAR_WIDTH, aspect: ArtAspect.resourceBar },
	holder: {
		x: 0,
		y: holderTop + Dial.holderWidth / ArtAspect.holder / 2,
		width: Dial.holderWidth,
		aspect: ArtAspect.holder,
	},
	/** Centred on the hole; sized so the disc fills it and tucks under the ring. */
	core: { x: holeX, y: holeY, width: coreWidth, aspect: ArtAspect.core },
	/** Ring centred on the hole, sized so its outer edge meets the bevel's outer edge. */
	wheel: {
		x: holeX - (Dial.ringCenter.X - ART_WIDTH / 2) * wheelScale,
		y: holeY + (ART_WIDTH / ArtAspect.wheel / 2 - Dial.ringCenter.Y) * wheelScale,
		width: wheelWidth,
		aspect: ArtAspect.wheel,
	},
} satisfies Record<string, Piece>;

/**
 * The top of the purple disc hides under the health capsule, so the Reservoir
 * level is measured over the VISIBLE part of the chamber: from the capsule's
 * bottom edge down to the disc's bottom. This is that span as a fraction of
 * the disc's height (a full reservoir fills it, empty shows the dark hole).
 */
const coreHeight = HudPieces.core.width / HudPieces.core.aspect;
export const RESERVOIR_VISIBLE_FRACTION = (HudPieces.core.y + coreHeight / 2 - HEALTH_HALF) / coreHeight;

export const HudPlacement = {
	/** Cluster height as a fraction of the screen's height. */
	height: 0.18,
	/** Gap between the cluster and the bottom of the screen, as a fraction of screen height. */
	bottomPadding: 0.02,
} as const;

export const HudArt = {
	health: {
		background: Images.BloodBackground,
		blood: Images.HealthBlood,
		/**
		 * Seamless version of the blood (assets/ui/source/HealthBloodTile.png).
		 * Upload it, add it to images.csv, run `npm run assets:images`, then set
		 * this to `Images.HealthBloodTile`. Until then the original texture is
		 * looped with crossfades.
		 */
		bloodTile: undefined as string | undefined,
		cover: Images.CapsuleCover,
		/** The glass interior the blood fills (the Studio clip Frame): centred, 92.5% wide. */
		fillInsetLeft: 0.0375,
		fillInsetWidth: 0.925,
	},
	oxygen: { bar: Images.OxygenBar, fill: Images.Oxygen },
	/**
	 * Point bars. Draw order matches Studio: back (-1) → glass (0) → fill (1).
	 * `fillLeft`/`fillRight` are where the liquid starts/ends in the fill art
	 * (fractions of its width), so fill amounts and point dividers line up.
	 */
	auxiliary: {
		back: Images.BackgroundAux,
		glass: Images.BackgroundAux2,
		fill: Images.Aux,
		fillLeft: 24 / 420,
		fillRight: 410 / 420,
	},
	stamina: {
		back: Images.Backgroundres2,
		glass: Images.Backgroundres,
		/**
		 * Purple, which clashes with the Reservoir. Upload
		 * assets/ui/source/StaminaFill.png (the same art recoloured green), add it
		 * to images.csv, run `npm run assets:images`, then set this to
		 * `Images.StaminaFill`.
		 */
		fill: Images.Res,
		fillLeft: 10 / 420,
		fillRight: 399 / 420,
	},
	/** Brass divider drawn between points on the Auxiliary / Stamina bars. */
	divider: { image: Images.Divider, heightFraction: 0.7 },
	/** Health readout ("3 / 4") on the capsule. */
	healthText: {
		font: new Font("rbxasset://fonts/families/Merriweather.json", Enum.FontWeight.Bold),
		color: Color3.fromRGB(240, 228, 214),
		strokeColor: Color3.fromRGB(40, 14, 12),
		strokeThickness: 1.5,
		/** Text height as a fraction of the capsule's height. */
		heightFraction: 0.6,
	},
	reservoir: { holder: Images.WheelAndWoe1, wheel: Images.Wheel, core: Images.Woe_v2, coreRotation: -180 },
} as const;

export const HudAnimation = {
	/**
	 * Health blood flow, in fill-area widths per second. Matches the Studio spec
	 * of moving 0 → 1.77 in 8 seconds.
	 */
	bloodSpeed: 1.77 / 8,
	/** Width of one blood texture copy, in fill-area widths (Studio: stretched 3× wide). */
	bloodWidth: 3,
	/** Width of one seamless tile copy: the trimmed texture (875 of 1200 px) at the same scale. */
	bloodTileWidth: 3 * (875 / 1200),
	/** Fallback loop (original texture only): crossfade width, and the transparent strip at each end. */
	bloodCrossfade: 0.15,
	bloodEdgeMargin: 18 / 420,
	/** Reservoir core spin, degrees per second (the wheel stays still). */
	reservoirSpinDegreesPerSecond: 25,
	/** Bar drain/refill smoothing (≈ 1 / seconds). */
	barSmoothing: 6,
} as const;
