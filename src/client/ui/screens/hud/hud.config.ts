import { Images } from "shared/assets/images";

/**
 * HUD layout, copied from the Studio layout (Gui to Lua export). Everything is
 * Scale-based on the ScreenGui, so the HUD scales with the screen. Tweak
 * numbers here; components only read this file.
 */

const CENTER = new Vector2(0.5, 0.5);

export const HudLayout = {
	/**
	 * Width ÷ height of the area the layout was designed in. Every position and
	 * size below is a fraction of a HUD frame locked to this shape (centred,
	 * bottom-aligned), not of the raw screen. That keeps the art identical at
	 * any resolution. On wider screens (e.g. 1080p) the images would otherwise
	 * shrink unevenly and the blood would spill over the capsule's end caps.
	 * Keep it at or below ~1.8, where the original layout is known to render
	 * correctly.
	 */
	designAspectRatio: 16 / 9,

	health: {
		anchor: CENTER,
		position: new UDim2(0.5, 0, 0.8, 0),
		size: new UDim2(0.4, 0, 0.05, 0),
		background: Images.BloodBackground,
		cover: Images.CapsuleCover,
		blood: Images.HealthBlood,
		/** The original clip Frame inside BloodBackground: centred, 92.5% wide. */
		fillInsetLeft: 0.0375,
		fillInsetWidth: 0.925,
		/** Blood texture size as a fraction of the fill area (width 3 = stretched 3× wide, as in Studio). */
		bloodWidth: 3,
	},
	oxygen: {
		anchor: CENTER,
		position: new UDim2(0.5, 0, 0.75, 0),
		size: new UDim2(0.4, 0, 0.05, 0),
		bar: Images.OxygenBar,
		fill: Images.Oxygen,
	},
	auxiliary: {
		anchor: CENTER,
		position: new UDim2(0.38, 0, 0.85, 0),
		size: new UDim2(0.15, 0, 0.05, 0),
		/** Draw order matches Studio: back (-1) → glass (0) → fill (1). */
		back: Images.BackgroundAux,
		glass: Images.BackgroundAux2,
		fill: Images.Aux,
	},
	stamina: {
		anchor: CENTER,
		position: new UDim2(0.62, 0, 0.85, 0),
		size: new UDim2(0.15, 0, 0.05, 0),
		back: Images.Backgroundres2,
		glass: Images.Backgroundres,
		fill: Images.Res,
	},
	reservoir: {
		anchor: CENTER,
		position: new UDim2(0.5, 0, 0.88, 0),
		size: new UDim2(0.12, 0, 0.13, 0),
		holder: Images.WheelAndWoe1,
		wheel: Images.Wheel,
		/** The "Reservoir" piece: flipped 180°, set slightly higher, and spins. */
		core: Images.Woe_v2,
		corePosition: new UDim2(0.5, 0, 0.84, 0),
		coreSize: new UDim2(0.06, 0, 0.11, 0),
		coreRotation: -180,
	},
} as const;

export const HudAnimation = {
	/**
	 * Health blood flow. Speed matches the Studio spec of moving 0 → 1.77 (fill
	 * widths) in `seconds`. Copies of the texture are chained with a crossfade
	 * of `crossfade` (fraction of one copy) so the loop never visibly resets.
	 */
	healthFlow: { from: 0, to: 1.77, seconds: 8, crossfade: 0.15 },
	/** Reservoir core spin, degrees per second (the wheel stays still). */
	reservoirSpinDegreesPerSecond: 25,
	/** Bar drain/refill smoothing (≈ 1 / seconds). */
	barSmoothing: 6,
} as const;
