import React, { type Binding } from "@rbxts/react";
import { vitalsAtom } from "client/store";
import { healthFractionAtom, localStatsAtom } from "client/store/stats";
import { ClippedFill } from "client/ui/components/clipped-fill";
import { useAnimationClock } from "client/ui/hooks/use-animation-clock";
import { useAtom } from "client/ui/hooks/use-atom";
import { useSmoothedNumber } from "client/ui/hooks/use-smoothed-number";
import { ArtAspect, HudAnimation, HudArt, HudPieces } from "./hud.config";
import { place } from "./hud.layout";
import { formatValue } from "./hud.format";

const ART = HudArt.health;
const ANIM = HudAnimation;

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
	/** Point dividers: over the blood, under the glass. */
	dividers: 5,
	cover: 10,
	text: 11,
} as const;

const TEXT = HudArt.healthText;
/** "3 / 4" readout, read straight from synced vitals and derived stats. */
function HealthText() {
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
			ZIndex={Z.text}
		>
			<uistroke Color={TEXT.strokeColor} Thickness={TEXT.strokeThickness} />
		</textlabel>
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
				Position={UDim2.fromScale(ART.fillInsetLeft + (ART.fillInsetWidth * k) / max, 0.5)}
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
	const tileWidth = ANIM.bloodTileWidth;
	const labelWidth = 1 + tileWidth;
	return (
		<imagelabel
			key="Blood"
			BackgroundTransparency={1}
			Image={image}
			ScaleType={Enum.ScaleType.Tile}
			TileSize={UDim2.fromScale(tileWidth / labelWidth, 1)}
			// Flows rightward like the Studio spec: x goes -tileWidth → 0, then wraps.
			Position={clock.map((t) => UDim2.fromScale(((t * ANIM.bloodSpeed) % tileWidth) - tileWidth, 0))}
			Size={UDim2.fromScale(labelWidth, 1)}
			ZIndex={Z.blood}
		/>
	);
}

/** Health capsule: back, flowing blood clipped to current health, point dividers, glass cover on top. */
export function HealthBar({ hovered = false }: { hovered?: boolean }) {
	const scale = useSmoothedNumber(hovered ? HudArt.hover.scale : 1, HudArt.hover.speed);
	const fraction = useSmoothedNumber(useAtom(healthFractionAtom), ANIM.barSmoothing);
	const clock = useAnimationClock();

	return (
		<frame key="Health" BackgroundTransparency={1} {...place(HudPieces.health)}>
			<uiscale Scale={scale} />
			<imagelabel
				key="Background"
				BackgroundTransparency={1}
				Size={UDim2.fromScale(1, 1)}
				Image={ART.background}
				ZIndex={Z.background}
			/>
			<ClippedFill
				fraction={fraction}
				insetLeft={ART.fillInsetLeft}
				insetWidth={ART.fillInsetWidth}
				zIndex={Z.fill}
			>
				<frame
					key="FillArea"
					BackgroundTransparency={1}
					ClipsDescendants={true}
					Position={UDim2.fromScale(ART.fillInsetLeft, 0)}
					Size={UDim2.fromScale(ART.fillInsetWidth, 1)}
					ZIndex={Z.fill}
				>
					<TiledBlood clock={clock} image={ART.bloodTile} />
				</frame>
			</ClippedFill>
			<HealthDividers />
			<imagelabel
				key="Cover"
				BackgroundTransparency={1}
				Size={UDim2.fromScale(1, 1)}
				Image={ART.cover}
				ZIndex={Z.cover}
			/>
			<HealthText />
		</frame>
	);
}
