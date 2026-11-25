import React, { type Binding, useRef } from "@rbxts/react";
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
	text: 11,
} as const;

const TEXT = HudArt.healthText;
const BEAT = HudArt.heartbeat;

/** Lub-dub envelope over one beat (phase 0..1): a strong pulse, then a softer one. */
function beatShape(phase: number): number {
	const pulse = (center: number, width: number) => math.exp(-(((phase - center) / width) ** 2));
	return math.max(pulse(0.06, 0.05), 0.6 * pulse(0.24, 0.05));
}

/**
 * Pulsing glow over the blood. The rate follows health: `restBpm` when full,
 * rising to `maxBpm` near zero. The phase is accumulated frame to frame, so a
 * rate change never makes the beat jump.
 */
function Heartbeat({ clock, healthFraction }: { clock: Binding<number>; healthFraction: number }) {
	const bpm = BEAT.restBpm + (BEAT.maxBpm - BEAT.restBpm) * (1 - math.clamp(healthFraction, 0, 1));
	// Persist across re-renders (health changes) so the rhythm continues smoothly.
	const state = useRef({ phase: 0, lastT: -1 });
	const glow = clock.map((t) => {
		const s = state.current;
		if (s.lastT >= 0) s.phase = (s.phase + (t - s.lastT) * (bpm / 60)) % 1;
		s.lastT = t;
		return beatShape(s.phase);
	});
	return (
		<frame
			key="Heartbeat"
			BackgroundColor3={BEAT.color}
			BackgroundTransparency={glow.map((g) => 1 - g * BEAT.intensity)}
			BorderSizePixel={0}
			Size={UDim2.fromScale(1, 1)}
			ZIndex={Z.blood + 1}
		>
			<uigradient
				Rotation={90}
				Transparency={
					new NumberSequence([
						new NumberSequenceKeypoint(0, 0.7),
						new NumberSequenceKeypoint(0.45, 0),
						new NumberSequenceKeypoint(1, 0.8),
					])
				}
			/>
		</frame>
	);
}

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
			ZIndex={Z.blood}
		/>
	);
}

/** Health capsule: back, flowing blood clipped to current health, glass cover on top. */
export function HealthBar() {
	const healthFraction = useAtom(healthFractionAtom);
	const fraction = useSmoothedNumber(healthFraction, ANIM.barSmoothing);
	const clock = useAnimationClock();

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
					<TiledBlood clock={clock} image={ART.bloodTile} />
					<Heartbeat clock={clock} healthFraction={healthFraction} />
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
