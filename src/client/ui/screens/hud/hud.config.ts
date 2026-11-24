import { Images } from "shared/assets/images";

/**
 * HUD layout, copied from the Studio layout (Gui to Lua export). Everything is
 * Scale-based on the ScreenGui, so the HUD scales with the screen. Tweak
 * numbers here; components only read this file.
 */

const CENTER = new Vector2(0.5, 0.5);

export const HudLayout = {
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
		/** Blood texture: AnchorPoint (0.63, 0.5), Size (3, 1) of the fill area. */
		bloodAnchor: new Vector2(0.63, 0.5),
		bloodSize: new UDim2(3, 0, 1, 0),
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
	/** Health blood scrolls its X position from `from` to `to` (scale), then resets. */
	healthFlow: { from: 0, to: 1.77, seconds: 8 },
	/** Reservoir core spin, degrees per second (the wheel stays still). */
	reservoirSpinDegreesPerSecond: 25,
	/** Bar drain/refill smoothing (≈ 1 / seconds). */
	barSmoothing: 6,
} as const;
