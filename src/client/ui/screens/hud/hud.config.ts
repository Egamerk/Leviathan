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
 * health capsule.
 */

/** Width ÷ height of each image (from the uploaded art). */
export const ArtAspect = {
	health: 420 / 26,
	oxygen: 420 / 14,
	resourceBar: 420 / 57,
	holder: 420 / 191,
	wheel: 420 / 258,
	core: 420 / 417,
} as const;

/** Gap between the health capsule and the rows above/below it (hw). */
const GAP = 0.012;
const HEALTH_HALF = 1 / ArtAspect.health / 2;
const OXYGEN_HALF = 1 / ArtAspect.oxygen / 2;
const BAR_WIDTH = 0.375;
const BAR_HALF = BAR_WIDTH / ArtAspect.resourceBar / 2;

export interface Piece {
	/** Centre x / y in hw from the health capsule's centre. */
	x: number;
	y: number;
	/** Width in hw; height = width / aspect. */
	width: number;
	aspect: number;
}

export const HudPieces = {
	oxygen: { x: 0, y: -(HEALTH_HALF + GAP + OXYGEN_HALF), width: 1, aspect: ArtAspect.oxygen },
	health: { x: 0, y: 0, width: 1, aspect: ArtAspect.health },
	auxiliary: { x: -0.3, y: HEALTH_HALF + GAP + BAR_HALF, width: BAR_WIDTH, aspect: ArtAspect.resourceBar },
	stamina: { x: 0.3, y: HEALTH_HALF + GAP + BAR_HALF, width: BAR_WIDTH, aspect: ArtAspect.resourceBar },
	holder: { x: 0, y: 0.1043, width: 0.3, aspect: ArtAspect.holder },
	core: { x: 0, y: 0.0522, width: 0.1445, aspect: ArtAspect.core },
	wheel: { x: 0, y: 0.1043, width: 0.276, aspect: ArtAspect.wheel },
} satisfies Record<string, Piece>;

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
	/** Draw order matches Studio: back (-1) → glass (0) → fill (1). */
	auxiliary: { back: Images.BackgroundAux, glass: Images.BackgroundAux2, fill: Images.Aux },
	stamina: { back: Images.Backgroundres2, glass: Images.Backgroundres, fill: Images.Res },
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
