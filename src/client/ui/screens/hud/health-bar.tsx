import React, { type Binding } from "@rbxts/react";
import { healthFractionAtom } from "client/store/stats";
import { ClippedFill } from "client/ui/components/clipped-fill";
import { useAnimationClock } from "client/ui/hooks/use-animation-clock";
import { useAtom } from "client/ui/hooks/use-atom";
import { useSmoothedNumber } from "client/ui/hooks/use-smoothed-number";
import { HudAnimation, HudArt, HudPieces } from "./hud.config";
import { place } from "./hud.layout";

const ART = HudArt.health;
const ANIM = HudAnimation;

/**
 * Seamless tile: two copies one tile-width apart, scrolled by `phase` mod the
 * tile width. The tile's ends match, so the wrap is invisible.
 */
function TiledBlood({ clock, image }: { clock: Binding<number>; image: string }) {
	const width = ANIM.bloodTileWidth;
	const phase = clock.map((t) => (t * ANIM.bloodSpeed) % width);
	return (
		<>
			{[-1, 0].map((k) => (
				<imagelabel
					key={`Blood${k}`}
					AnchorPoint={new Vector2(0, 0.5)}
					BackgroundTransparency={1}
					Position={phase.map((p) => new UDim2(k * width + p, 0, 0.5, 0))}
					Size={new UDim2(width, 0, 1, 0)}
					Image={image}
				/>
			))}
		</>
	);
}

/**
 * Fallback for the original (non-tileable) texture: a chain of copies, each
 * crossfading into the previous after its transparent end strip.
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
					ZIndex={4 + k}
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
			/>
			<ClippedFill fraction={fraction} insetLeft={ART.fillInsetLeft} insetWidth={ART.fillInsetWidth} zIndex={2}>
				<frame
					key="FillArea"
					BackgroundTransparency={1}
					ClipsDescendants={true}
					Position={UDim2.fromScale(ART.fillInsetLeft, 0)}
					Size={UDim2.fromScale(ART.fillInsetWidth, 1)}
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
				ZIndex={3}
			/>
		</frame>
	);
}
