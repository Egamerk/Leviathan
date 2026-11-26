import { Images } from "shared/assets/images";
import type { LiquidOverlay } from "./resource-bar";

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
	oxygenTube: 998 / 52,
} as const;

/**
 * Oxygen as a tube in the same family as Auxiliary / Stamina (caps on both
 * ends), filled with pale gas and rising bubbles so it reads as air, not
 * liquid (art in assets/ui/source). Clearing `back`, `glass` or `flowTile`
 * falls back to the thin original bar.
 */
const OxygenTubeArt = {
	back: Images.OxygenTube as string | undefined,
	glass: Images.OxygenGlass as string | undefined,
	flowTile: Images.OxygenTile as string | undefined,
	flowTileAspect: 508 / 60,
	/** Bubbles carried left → right along the tube with the gas. */
	overlay: {
		image: Images.OxygenBubbles as string | undefined,
		aspect: 512 / 128,
		velocityX: 0.45,
		velocityY: 0,
	} as LiquidOverlay,
	/** "O₂" label centred on the tube (shows the percentage on hover). */
	label: true,
	/** Brass caps keep their shape when the tube is wider than the art (only the glass stretches). */
	artAspect: ArtAspect.oxygenTube,
	sliceCap: 0.05,
	anchor: "left" as "left" | "right",
	capsBothEnds: true,
	fillLeft: 0.0225,
	fillRight: 0.9775,
	fillTop: 21 / 104,
	fillBottom: 82 / 104,
} as const;

/** Gap between the health capsule and the rows above/below it (hw). */
const GAP = 0.016;
const HEALTH_HALF = 1 / ArtAspect.health / 2;
const BAR_WIDTH = 0.375;
/** Width of the Reservoir holder (Wheel&Woe1) under the health capsule (hw). */
const HOLDER_WIDTH = 0.36;
/** Gap between the holder's edge and the inner end of Auxiliary / Stamina (hw). */
const BAR_CLEARANCE = 0.012;
/** Auxiliary / Stamina sit either side of the holder without touching it. */
const BAR_OUTER = HOLDER_WIDTH / 2 + BAR_CLEARANCE + BAR_WIDTH;
const BAR_X = BAR_OUTER - BAR_WIDTH / 2;
const BAR_HALF = BAR_WIDTH / ArtAspect.resourceBar / 2;
/**
 * Health is widened (same thickness) so it spans both small bars plus a small
 * margin. Its brass caps keep their shape; only the glass stretches.
 */
const HEALTH_WIDTH = 2 * (BAR_OUTER + 0.0125);
const HEALTH_HEIGHT = 1 / ArtAspect.health;
/**
 * Oxygen: with the new tube it spans Auxiliary's outer cap to Stamina's outer
 * cap (its original thickness), so the stack reads as one block. The thin
 * original bar is a little shorter than health.
 */
export const USE_OXYGEN_TUBE =
	OxygenTubeArt.back !== undefined && OxygenTubeArt.glass !== undefined && OxygenTubeArt.flowTile !== undefined;
const OXYGEN_WIDTH = USE_OXYGEN_TUBE ? 2 * BAR_OUTER : 0.82 * HEALTH_WIDTH;
const OXYGEN_HEIGHT = USE_OXYGEN_TUBE ? (2 * 0.3 + BAR_WIDTH) / ArtAspect.oxygenTube : 0.82 / ArtAspect.oxygen;
const OXYGEN_ASPECT = OXYGEN_WIDTH / OXYGEN_HEIGHT;
const OXYGEN_HALF = OXYGEN_HEIGHT / 2;

/**
 * Reservoir dial geometry, measured from the art (pixels in each image at
 * 420 px wide). Used to make the three pieces concentric: the purple core
 * fills the holder's hole, and the brass ring sits on the hole's bevelled rim.
 */
const Dial = {
	/** The dial is the HUD's centrepiece; large enough for the gauge slices to read. */
	holderWidth: HOLDER_WIDTH,
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
	oxygen: { x: 0, y: -(HEALTH_HALF + GAP + OXYGEN_HALF), width: OXYGEN_WIDTH, aspect: OXYGEN_ASPECT },
	health: { x: 0, y: 0, width: HEALTH_WIDTH, aspect: HEALTH_WIDTH / HEALTH_HEIGHT },
	auxiliary: { x: -BAR_X, y: HEALTH_HALF + GAP + BAR_HALF, width: BAR_WIDTH, aspect: ArtAspect.resourceBar },
	stamina: { x: BAR_X, y: HEALTH_HALF + GAP + BAR_HALF, width: BAR_WIDTH, aspect: ArtAspect.resourceBar },
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

/** Radius of the Reservoir's visible liquid (inside the brass ring), in hw. */
const DISC_RADIUS = (HudPieces.core.width / 2) * 0.94;
/** How far above the disc centre the bridge plate's bottom edge sits (scales with the dial). */
const BRIDGE_DROP = 0.18 * DISC_RADIUS;
/** The plate's top sits just under the health capsule's bottom edge. */
const BRIDGE_TOP = HEALTH_HALF - 0.002;
const BRIDGE_BOTTOM = HudPieces.core.y - BRIDGE_DROP;
const BRIDGE_WIDTH = 2 * math.sqrt(math.max(DISC_RADIUS * DISC_RADIUS - BRIDGE_DROP * BRIDGE_DROP, 0)) + 0.004;

/** The brass bridge plate over the top of the Reservoir chamber. */
export const ReservoirBridge: Piece = {
	x: HudPieces.core.x,
	y: (BRIDGE_TOP + BRIDGE_BOTTOM) / 2,
	width: BRIDGE_WIDTH,
	aspect: BRIDGE_WIDTH / (BRIDGE_BOTTOM - BRIDGE_TOP),
};

/**
 * Gauge arc (degrees): everything below the bridge plate's bottom edge, i.e.
 * a half circle plus the two slivers down to where the end spokes meet the plate.
 */
export const RESERVOIR_ARC_DEGREES = 180 + 2 * math.deg(math.asin(BRIDGE_DROP / DISC_RADIUS));

/**
 * Where the chamber is cut off, as a fraction of the disc's height from its
 * top: the bridge plate's bottom edge. Everything in the chamber is hidden
 * above this line, so the disc never shows through the health capsule's glass
 * when health is low.
 */
const CORE_HEIGHT = HudPieces.core.width / HudPieces.core.aspect;
export const RESERVOIR_CHAMBER_CUT = (BRIDGE_BOTTOM - (HudPieces.core.y - CORE_HEIGHT / 2)) / CORE_HEIGHT;

export const HudPlacement = {
	/** Cluster height as a fraction of the screen's height. */
	height: 0.2,
	/** Gap between the cluster and the bottom of the screen, as a fraction of screen height. */
	bottomPadding: 0.03,
} as const;

export const HudArt = {
	health: {
		background: Images.BloodBackground,
		/** Seamless blood tile (made from HealthBlood: ends trimmed, baked-in line softened, ends blended). */
		bloodTile: Images.HealthBloodTile,
		cover: Images.CapsuleCover,
		/** The glass interior the blood fills (the Studio clip Frame): centred, 92.5% wide. */
		fillInsetLeft: 0.0375,
		fillInsetWidth: 0.925,
		/** Width of each brass cap region kept unstretched when the capsule is widened (fraction of the art). */
		sliceCap: 0.06,
	},
	/**
	 * The fill sits BEHIND the glass tube (so the glass, outline and brass caps
	 * stay on top), clipped to the tube's interior between the caps, and
	 * tinted a pale air-blue so it reads as a gauge rather than a flat sticker.
	 */
	oxygen: {
		bar: Images.OxygenBar,
		fill: Images.Oxygen,
		fillLeft: 17 / 768,
		fillRight: 750 / 768,
		tint: Color3.fromRGB(215, 238, 246),
		transparency: 0.1,
	},
	/** See OxygenTubeArt at the top of this file. */
	oxygenTube: OxygenTubeArt,
	/**
	 * Point bars. Draw order matches Studio: back (-1) → glass (0) → fill (1).
	 * `fillLeft`/`fillRight` are where the liquid starts/ends in the fill art
	 * (fractions of its width), so fill amounts and point dividers line up.
	 */
	auxiliary: {
		back: Images.BackgroundAux,
		glass: Images.BackgroundAux2,
		/** Brass cap on the outer (left) end. The liquid sits at the inner end and drains toward the middle. */
		cap: "left" as "left" | "right",
		anchor: "right" as "left" | "right",
		fillLeft: 24 / 420,
		fillRight: 410 / 420,
		/** Top/bottom of the liquid pill in the fill art (fractions of its height). */
		fillTop: 21 / 104,
		fillBottom: 82 / 104,
		/** Seamless strip for the flowing liquid (assets/ui/source/AuxTile.png). */
		flowTile: Images.AuxTile,
		/** Width ÷ height of the flow tile. */
		flowTileAspect: 508 / 60,
		/** No overlay: just the liquid flowing. */
		overlay: undefined as LiquidOverlay | undefined,
	},
	stamina: {
		back: Images.Backgroundres2,
		glass: Images.Backgroundres,
		/** Brass cap on the outer (right) end. The liquid sits at the inner end and drains toward the middle. */
		cap: "right" as "left" | "right",
		anchor: "left" as "left" | "right",
		/** Stamina dims as it drains: at the last sliver it's at 45% brightness. */
		darkenWhenLow: 0.55,
		fillLeft: 10 / 420,
		fillRight: 399 / 420,
		fillTop: 21 / 104,
		fillBottom: 82 / 104,
		/**
		 * Seamless liquid strip. Green: Images.StaminaTile (StaminaTile.png).
		 * Blue: Images.StaminaTileBlue (StaminaTileBlue.png). Swap to compare.
		 */
		flowTile: Images.StaminaTileBlue,
		flowTileAspect: 511 / 60,
		/**
		 * Icy-blue specks drifting up and flickering (assets/ui/source/StaminaEmbers.png,
		 * AuxEmbers recoloured; StaminaStreaks is the old overlay). Clearing `image` removes the overlay.
		 */
		overlay: {
			image: Images.StaminaEmbers as string | undefined,
			aspect: 512 / 128,
			velocityX: 0.04,
			velocityY: 0.28,
			flicker: 0.35,
		} as LiquidOverlay | undefined,
	},
	/**
	 * End shading for the flowing Auxiliary / Stamina liquids, matching the
	 * original fill art: each end darkens toward the edge, giving the liquid
	 * depth inside the tube. Brightness multipliers; `length` is in liquid heights.
	 */
	liquidShading: { edge: 0.62, shoulder: 0.84, length: 0.8 },
	/** Brass divider drawn between points on the Auxiliary / Stamina bars. */
	/** Divider image between points; taller than the liquid so its ends stick out a little past it. */
	divider: { image: Images.Divider, heightFraction: 1.05 },
	/** Dividers on the health capsule, one per whole health point (height = fraction of the capsule). */
	healthDivider: { heightFraction: 0.78 },
	/** Hover feedback: hovered tubes/capsules ease up to this scale; the dial gets a glow ring. Hovering Oxygen shows its %. */
	hover: {
		scale: 1.04,
		speed: 16,
		dialGlow: Color3.fromRGB(214, 186, 255),
	},
	/** Health readout ("3 / 4") on the capsule. */
	healthText: {
		font: new Font("rbxasset://fonts/families/Merriweather.json", Enum.FontWeight.Bold),
		color: Color3.fromRGB(240, 228, 214),
		strokeColor: Color3.fromRGB(40, 14, 12),
		strokeThickness: 1.5,
		/** Text height as a fraction of the capsule's height. */
		heightFraction: 0.6,
	},
	reservoir: {
		holder: Images.WheelAndWoe1,
		wheel: Images.Wheel,
		core: Images.Woe_v2,
		/**
		 * Vivid violet disc with spiral arms (assets/ui/source/ReservoirSwirl.png),
		 * so the spin is clearly visible. If it fails to load (e.g. still in
		 * moderation), the dial falls back to the original `core` disc.
		 */
		swirl: Images.ReservoirSwirl as string | undefined,
		/**
		 * Occult rune ring turning slowly against the swirl (assets/ui/source/
		 * ReservoirRunes.png); shown while Reservoir is unlocked.
		 */
		runes: Images.ReservoirRunes as string | undefined,
		runesTransparency: 0.15,
		runesSpinDegreesPerSecond: -12,
		coreRotation: -180,
		/**
		 * While Reservoir is LOCKED (Depth Affinity below the unlock and not an
		 * Occultist/Apostle), the chamber shows dimmed, slow-turning liquid
		 * instead of an empty hole, so it reads as "dormant" rather than broken.
		 */
		dormantTint: Color3.fromRGB(150, 140, 175),
		dormantTransparency: 0.45,
		/**
		 * Unlocked: an arc gauge split into one slice per Reservoir point. The
		 * top of the disc hides under the health capsule, so the gauge uses the
		 * visible lower arc, filling left → right through the bottom.
		 */
		gauge: {
			/** Empty slices: much darker liquid, so full slices stand out. */
			emptyTint: Color3.fromRGB(70, 60, 95),
			emptyTransparency: 0.15,
			/** Brass spokes between slices: line and its dark outline, as fractions of the disc's width. */
			spokeColor: Color3.fromRGB(201, 146, 86),
			spokeOutline: Color3.fromRGB(40, 24, 16),
			spokeWidth: 0.014,
			spokeOutlineWidth: 0.03,
			/** Spoke length as a fraction of the disc's diameter (from the centre outward). */
			spokeLength: 0.94,
		},
		/**
		 * Brass bridge plate across the top of the chamber (under the health
		 * capsule), so the gauge looks deliberately framed. The arc's end spokes
		 * meet its bottom edge. Its size is `ReservoirBridge` (geometry section).
		 */
		bridge: {
			light: Color3.fromRGB(214, 160, 98),
			dark: Color3.fromRGB(120, 72, 40),
			outline: Color3.fromRGB(46, 26, 14),
			rivet: Color3.fromRGB(96, 56, 30),
			rivetHighlight: Color3.fromRGB(230, 186, 130),
		},
	},
} as const;

export const HudAnimation = {
	/**
	 * Health blood flow, in fill-area widths per second. Matches the Studio spec
	 * of moving 0 → 1.77 in 8 seconds.
	 */
	bloodSpeed: 1.77 / 8,
	/**
	 * On-screen speed shared by every flowing liquid, in health widths per
	 * second (the blood's speed: 1.77/8 fill-area widths, and the fill area is
	 * 92.5% of the capsule). Bars convert it to their own width so all liquids
	 * move together.
	 */
	liquidSpeed: (1.77 / 8) * 0.925,
	/** Flow direction per bar: 1 = rightward (like the blood), -1 = leftward. */
	auxiliaryFlowDirection: -1,
	staminaFlowDirection: 1,
	/** Flow speed of each liquid as a multiple of `liquidSpeed`. */
	auxiliaryFlowSpeed: 0.25,
	staminaFlowSpeed: 0.5,
	/**
	 * Width of one blood tile, in fill-area widths. The original texture was
	 * stretched 3× wide; the tile is the trimmed 875 of its 1200 px at that scale.
	 */
	bloodTileWidth: 3 * (875 / 1200),
	/** Reservoir core spin, degrees per second (the wheel stays still). */
	reservoirSpinDegreesPerSecond: 25,
	/** Spin speed multiplier while Reservoir is locked (dormant). */
	reservoirDormantSpinFactor: 0.4,
	/** Bar drain/refill smoothing (≈ 1 / seconds). */
	barSmoothing: 6,
} as const;
