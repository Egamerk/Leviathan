import React, { type Binding } from "@rbxts/react";
import { vitalsAtom } from "client/store";
import { healthFractionAtom, localStatsAtom } from "client/store/stats";
import { ClippedFill } from "client/ui/components/clipped-fill";
import { useAnimationClock } from "client/ui/hooks/use-animation-clock";
import { useAtom } from "client/ui/hooks/use-atom";
import { useSmoothedNumber } from "client/ui/hooks/use-smoothed-number";
import { HudAnimation, HudArt, HudPieces } from "./hud.config";
import { place } from "./hud.layout";

const ART = HudArt.health;
const ANIM = HudAnimation;

/**
 * Draw order for the health capsule. Every blood layer (all copies, in either
 * loop mode) stays below `cover`, so the glass is always on top, even under
 * Global ZIndexBehavior or if the blood is reparented.
 */
const Z = {
	background: 1,
	/** The clipped fill frames holding the blood. */
	fill: 2,
	/** Blood copies use bloodBase (tile) or bloodBase .. bloodBase + 2 (fallback chain). */
	bloodBase: 2,
	cover: 10,
	text: 11,
} as const;

const TEXT = HudArt.healthText;

/** "3", "3.5", never "3.50" or "3.0". */
function formatValue(value: number): string {
	const rounded = math.round(value * 10) / 10;
	return rounded % 1 === 0 ? tostring(rounded) : string.format("%.1f", rounded);
}

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
			ZIndex={Z.bloodBase}
		/>
	);
}

/**
 * Fallback until HealthBloodTile is uploaded: the original texture isn't
 * tileable, so it needs a chain of copies, each crossfading into the previous
 * after its transparent end strip. Delete this once `bloodTile` is set.
 */
function CrossfadedBlood({ clock, image }: { clock: Binding<number>; image: string }) {
	const edge = ANIM.bloodEdgeMargin;
	const fade = ANIM.bloodCrossfade;
	const period = ANIM.bloodWidth * (1 - 2 * edge - fade);
	const phase = clock.map((t) => (t * ANIM.bloodSpeed) % period);
	const seamFade = new NumberSequence([
		new NumberSequenceKeypoint(0, 1),
		new NumberSequenceKeypoint(edge, 1),
		new NumberSequenceKeypoint(edge + fade, 0),
		new NumberSequenceKeypoint(1, 0),
	]);
	return (
		<>
			{[-2, -1, 0].map((k) => (
				<imagelabel
					key={`Blood${k}`}
					AnchorPoint={new Vector2(0, 0.5)}
					BackgroundTransparency={1}
					Position={phase.map((p) => new UDim2(k * period + p, 0, 0.5, 0))}
					Size={new UDim2(ANIM.bloodWidth, 0, 1, 0)}
					Image={image}
					ZIndex={Z.bloodBase + 2 + k}
				>
					<uigradient Transparency={seamFade} />
				</imagelabel>
			))}
		</>
	);
}

/** Health capsule: back, flowing blood clipped to current health, glass cover on top. */
export function HealthBar() {
	const fraction = useSmoothedNumber(useAtom(healthFractionAtom), ANIM.barSmoothing);
	const clock = useAnimationClock();
	const tile = ART.bloodTile;

	return (
		<frame key="Health" BackgroundTransparency={1} {...place(HudPieces.health)}>
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
					{tile !== undefined ? (
						<TiledBlood clock={clock} image={tile} />
					) : (
						<CrossfadedBlood clock={clock} image={ART.blood} />
					)}
				</frame>
			</ClippedFill>
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
