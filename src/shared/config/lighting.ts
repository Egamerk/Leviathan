/**
 * Lighting presets, one per kind of area. The client blends to the preset of
 * the zone the player is standing in (see client/controllers/world/lighting.controller.ts).
 *
 * Zones: any Part tagged "LightingZone" (CollectionService / Tag Editor) with a
 * string attribute "Preset" naming a preset below, e.g. "Cathedral". The part
 * can be invisible, non-colliding and anchored; only its box matters. When
 * zones overlap, the one with the higher number attribute "Priority" wins.
 * Outside every zone, `LightingDefault` applies.
 *
 * Testing: set the Workspace attribute "LightingPreset" (or use the Studio
 * chat command `/lighting cathedral`) to force a preset; clear it to go back
 * to zones.
 *
 * Point lights, spot lights and lamps are placed in the map. These presets set
 * the mood around them: ambient darkness, fog, colour grading and glow.
 */

export interface LightingPreset {
	/** Lighting service. */
	lighting: {
		Ambient: Color3;
		OutdoorAmbient: Color3;
		Brightness: number;
		ClockTime: number;
		/** Tilts the sun/moon; adjust so the light shafts come through the windows. */
		GeographicLatitude: number;
		ColorShift_Top: Color3;
		ColorShift_Bottom: Color3;
		EnvironmentDiffuseScale: number;
		EnvironmentSpecularScale: number;
		ExposureCompensation: number;
	};
	atmosphere: {
		Density: number;
		Offset: number;
		Color: Color3;
		Decay: Color3;
		Glare: number;
		Haze: number;
	};
	colorCorrection: { Brightness: number; Contrast: number; Saturation: number; TintColor: Color3 };
	bloom: { Intensity: number; Size: number; Threshold: number };
	sunRays: { Intensity: number; Spread: number };
	depthOfField: { FarIntensity: number; FocusDistance: number; InFocusRadius: number; NearIntensity: number };
}

const rgb = Color3.fromRGB;

export const LightingPresets = {
	/**
	 * Industrial corridors (first screenshot): near-black ambient so the warm
	 * caged lamps do the work, thick warm haze, glow around each lamp, slightly
	 * desaturated and warm-tinted.
	 */
	Corridor: {
		lighting: {
			Ambient: rgb(14, 13, 12),
			OutdoorAmbient: rgb(22, 20, 18),
			Brightness: 0.4,
			ClockTime: 0,
			GeographicLatitude: 0,
			ColorShift_Top: rgb(0, 0, 0),
			ColorShift_Bottom: rgb(0, 0, 0),
			EnvironmentDiffuseScale: 0.15,
			EnvironmentSpecularScale: 0.5,
			ExposureCompensation: 0.15,
		},
		atmosphere: {
			Density: 0.38,
			Offset: 0.1,
			Color: rgb(70, 60, 46),
			Decay: rgb(34, 28, 20),
			Glare: 0,
			Haze: 1.6,
		},
		colorCorrection: { Brightness: 0, Contrast: 0.12, Saturation: -0.18, TintColor: rgb(255, 238, 214) },
		bloom: { Intensity: 0.7, Size: 26, Threshold: 1.5 },
		sunRays: { Intensity: 0, Spread: 0.5 },
		depthOfField: { FarIntensity: 0.12, FocusDistance: 30, InFocusRadius: 60, NearIntensity: 0 },
	},
	/**
	 * Gothic cathedral (second screenshot): cold blue key light through tall
	 * windows with visible shafts, deep blue shadows, thick pale-blue haze and
	 * soft glow on the windows and lanterns.
	 */
	Cathedral: {
		lighting: {
			Ambient: rgb(26, 32, 58),
			OutdoorAmbient: rgb(60, 72, 120),
			Brightness: 2.2,
			ClockTime: 16.8,
			GeographicLatitude: 35,
			ColorShift_Top: rgb(150, 175, 255),
			ColorShift_Bottom: rgb(20, 26, 60),
			EnvironmentDiffuseScale: 0.4,
			EnvironmentSpecularScale: 0.6,
			ExposureCompensation: -0.15,
		},
		atmosphere: {
			Density: 0.42,
			Offset: 0.25,
			Color: rgb(122, 142, 205),
			Decay: rgb(58, 70, 125),
			Glare: 0.35,
			Haze: 2.4,
		},
		colorCorrection: { Brightness: 0.02, Contrast: 0.16, Saturation: -0.12, TintColor: rgb(200, 214, 255) },
		bloom: { Intensity: 0.85, Size: 32, Threshold: 1.15 },
		sunRays: { Intensity: 0.12, Spread: 0.65 },
		depthOfField: { FarIntensity: 0.18, FocusDistance: 40, InFocusRadius: 80, NearIntensity: 0 },
	},
} satisfies Record<string, LightingPreset>;

export type LightingPresetName = keyof typeof LightingPresets;

/** Preset used outside every zone. */
export const LightingDefault: LightingPresetName = "Corridor";

/** Seconds to blend from one preset to the next. */
export const LightingBlendSeconds = 1.6;

export const LightingZoneTag = "LightingZone";
/** Workspace attribute that forces a preset (testing). */
export const LightingOverrideAttribute = "LightingPreset";

export function isLightingPreset(name: unknown): name is LightingPresetName {
	return typeIs(name, "string") && name in LightingPresets;
}
