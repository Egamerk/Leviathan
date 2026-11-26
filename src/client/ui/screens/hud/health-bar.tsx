import React, { type Binding } from "@rbxts/react";
import { vitalsAtom } from "client/store";
import { healthFractionAtom, localStatsAtom } from "client/store/stats";
import { ClippedFill } from "client/ui/components/clipped-fill";
import { SlicedImage, slicedInset } from "client/ui/components/sliced-image";
import { useAnimationClock } from "client/ui/hooks/use-animation-clock";
import { useAtom } from "client/ui/hooks/use-atom";
import { useSmoothedNumber } from "client/ui/hooks/use-smoothed-number";
import { ArtAspect, HudAnimation, HudArt, HudPieces } from "./hud.config";
import { place } from "./hud.layout";
import { formatValue } from "./hud.format";

const ART = HudArt.health;
const ANIM = HudAnimation;

/**
 * The capsule is wider than its art: the caps keep their shape, so the blood
 * area (between the caps) grows. FILL_LEFT / FILL_WIDTH are fractions of the
 * widened capsule; BLOOD_SCALE keeps the blood texture and its speed at the
 * same on-screen size as before.
 */
const BOX_ASPECT = HudPieces.health.aspect;
const FILL_LEFT = slicedInset(ART.fillInsetLeft, ArtAspect.health, BOX_ASPECT);
const FILL_WIDTH = 1 - 2 * FILL_LEFT;
const BLOOD_SCALE = (ART.fillInsetWidth * math.min(ArtAspect.health / BOX_ASPECT, 1)) / FILL_WIDTH;

/**
 * Draw order for the health capsule. The blood stays below `cover`, so the
 * glass is always on top, even under Global ZIndexBehavior or if the blood is
 * reparented.
 */
const Z = {
	background: 1,
	/** The clipped fill frames holding the blood. */
	fill: 2,
	blood: 2,
	cover: 10,
	/** Cracks in the glass. */
	cracks: 11,
	/** Point dividers: on top of the glass, like the Auxiliary / Stamina dividers. */
	dividers: 12,
	text: 13,
} as const;

const TEXT = HudArt.healthText;
/** "3 / 4" readout, read straight from synced vitals and derived stats. Fades in while hovered. */
function HealthText({ reveal }: { reveal: Binding<number> }) {
	const vitals = useAtom(vitalsAtom);
	const stats = useAtom(localStatsAtom);
	if (vitals === undefined || stats === undefined) return undefined;
	return (
		<textlabel
			key="Readout"
			AnchorPoint={new Vector2(0.5, 0.5)}
			BackgroundTransparency={1}
			Position={UDim2.fromScale(0.5, 0.5)}
			Size={UDim2.fromScale(0.5, TEXT.heightFraction)}
			FontFace={TEXT.font}
			Text={`${formatValue(vitals.health)} / ${formatValue(stats.maxHealth)}`}
			TextColor3={TEXT.color}
			TextScaled={true}
			TextTransparency={reveal.map((r) => 1 - r)}
			Visible={reveal.map((r) => r > 0.01)}
			ZIndex={Z.text}
		>
			<uistroke
				Color={TEXT.strokeColor}
				Thickness={TEXT.strokeThickness}
				Transparency={reveal.map((r) => 1 - r)}
			/>
		</textlabel>
	);
}

/** The crack set for a health fraction: the lowest threshold it's at or below, if any. */
function crackIndex(fraction: number): number | undefined {
	let index: number | undefined;
	let lowest = math.huge;
	ART.cracks.forEach((crack, i) => {
		if (fraction <= crack.atOrBelow + 1e-6 && crack.atOrBelow < lowest) {
			lowest = crack.atOrBelow;
			index = i;
		}
	});
	return index;
}

/** One crack image, fading in while it's the active set. */
function Crack({ image, active }: { image: string; active: boolean }) {
	const visible = useSmoothedNumber(active ? 1 : 0, ART.crackFadeSpeed);
	return (
		<imagelabel
			BackgroundTransparency={1}
			Image={image}
			ImageTransparency={visible.map((v) => 1 - v)}
			Position={UDim2.fromScale(FILL_LEFT, 0)}
			Size={UDim2.fromScale(FILL_WIDTH, 1)}
			Visible={visible.map((v) => v > 0.01)}
			ZIndex={Z.cracks}
		/>
	);
}

/** Glass cracks at low health (uses actual health, not the smoothed bar). */
function HealthCracks() {
	const active = crackIndex(useAtom(healthFractionAtom));
	return (
		<>
			{ART.cracks.map((crack, i) => (
				<Crack key={`Crack${i}`} image={crack.image} active={active === i} />
			))}
		</>
	);
}

/** One brass divider per whole health point (e.g. 3 between 4 points). */
function HealthDividers() {
	const stats = useAtom(localStatsAtom);
	const max = stats?.maxHealth ?? 0;
	const height = HudArt.healthDivider.heightFraction;
	const width = (height * ArtAspect.divider) / HudPieces.health.aspect;
	const dividers = new Array<React.Element>();
	for (let k = 1; k < max; k++) {
		dividers.push(
			<imagelabel
				key={`Divider${k}`}
				AnchorPoint={new Vector2(0.5, 0.5)}
				BackgroundTransparency={1}
				Image={HudArt.divider.image}
				ScaleType={Enum.ScaleType.Crop}
				Position={UDim2.fromScale(FILL_LEFT + (FILL_WIDTH * k) / max, 0.5)}
				Size={UDim2.fromScale(width, height)}
				ZIndex={Z.dividers}
			/>,
		);
	}
	return <>{dividers}</>;
}

/**
 * Seamless tile in ONE ImageLabel: `ScaleType.Tile` repeats the texture across
 * a label one tile wider than the fill area. Sliding it by
 * `phase = (t × speed) mod tileWidth` loops with no visible wrap, because the
 * tile's ends match.
 */
function TiledBlood({ clock, image }: { clock: Binding<number>; image: string }) {
	const tileWidth = ANIM.bloodTileWidth * BLOOD_SCALE;
	const speed = ANIM.bloodSpeed * BLOOD_SCALE;
	const labelWidth = 1 + tileWidth;
	return (
		<imagelabel
			key="Blood"
			BackgroundTransparency={1}
			Image={image}
			ScaleType={Enum.ScaleType.Tile}
			TileSize={UDim2.fromScale(tileWidth / labelWidth, 1)}
			// Flows rightward like the Studio spec: x goes -tileWidth → 0, then wraps.
			Position={clock.map((t) => UDim2.fromScale(((t * speed) % tileWidth) - tileWidth, 0))}
			Size={UDim2.fromScale(labelWidth, 1)}
			ZIndex={Z.blood}
		/>
	);
}

/** Health capsule: back, flowing blood clipped to current health, glass cover, point dividers on top. */
export function HealthBar({ hovered = false }: { hovered?: boolean }) {
	const scale = useSmoothedNumber(hovered ? HudArt.hover.scale : 1, HudArt.hover.speed);
	const reveal = useSmoothedNumber(hovered ? 1 : 0, HudArt.hover.speed);
	const fraction = useSmoothedNumber(useAtom(healthFractionAtom), ANIM.barSmoothing);
	const clock = useAnimationClock();

	return (
		<frame key="Health" BackgroundTransparency={1} {...place(HudPieces.health)}>
			<uiscale Scale={scale} />
			<frame key="Background" BackgroundTransparency={1} Size={UDim2.fromScale(1, 1)} ZIndex={Z.background}>
				<SlicedImage
					image={ART.background}
					artAspect={ArtAspect.health}
					boxAspect={BOX_ASPECT}
					cap={ART.sliceCap}
					zIndex={Z.background}
				/>
			</frame>
			<ClippedFill fraction={fraction} insetLeft={FILL_LEFT} insetWidth={FILL_WIDTH} zIndex={Z.fill}>
				<frame
					key="FillArea"
					BackgroundTransparency={1}
					ClipsDescendants={true}
					Position={UDim2.fromScale(FILL_LEFT, 0)}
					Size={UDim2.fromScale(FILL_WIDTH, 1)}
					ZIndex={Z.fill}
				>
					<TiledBlood clock={clock} image={ART.bloodTile} />
				</frame>
			</ClippedFill>
			<HealthCracks />
			<HealthDividers />
			<frame key="Cover" BackgroundTransparency={1} Size={UDim2.fromScale(1, 1)} ZIndex={Z.cover}>
				<SlicedImage
					image={ART.cover}
					artAspect={ArtAspect.health}
					boxAspect={BOX_ASPECT}
					cap={ART.sliceCap}
					zIndex={Z.cover}
				/>
			</frame>
			<HealthText reveal={reveal} />
		</frame>
	);
}
