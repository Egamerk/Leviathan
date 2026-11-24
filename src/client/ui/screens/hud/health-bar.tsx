import React from "@rbxts/react";
import { healthFractionAtom } from "client/store/stats";
import { ClippedFill } from "client/ui/components/clipped-fill";
import { useAnimationClock } from "client/ui/hooks/use-animation-clock";
import { useAtom } from "client/ui/hooks/use-atom";
import { useSmoothedNumber } from "client/ui/hooks/use-smoothed-number";
import { HudAnimation, HudLayout } from "./hud.config";

const L = HudLayout.health;
const FLOW = HudAnimation.healthFlow;

/** Fill widths per second. */
const FLOW_SPEED = (FLOW.to - FLOW.from) / FLOW.seconds;
const EDGE = FLOW.textureEdgeMargin;
/**
 * Distance between chained copies. A copy's fade (its left edge, after the
 * transparent margin) must lie over the previous copy's solid blood, which
 * ends before that copy's right margin. So copies overlap by margin + fade + margin.
 */
const PERIOD = L.bloodWidth * (1 - 2 * EDGE - FLOW.crossfade);
/**
 * Copy k sits at k × PERIOD + phase. With phase in [0, PERIOD), copies -2..0
 * cover the visible area, and every faded seam has an opaque copy beneath it.
 * Higher k draws on top, so each copy's fading left edge blends into its left
 * neighbour. At phase = PERIOD the picture equals phase = 0, so the wrap is invisible.
 */
const COPIES = [-2, -1, 0];

/** Each copy fades in just after its transparent left margin, blending into the copy beneath it. */
const SEAM_FADE = new NumberSequence([
	new NumberSequenceKeypoint(0, 1),
	new NumberSequenceKeypoint(EDGE, 1),
	new NumberSequenceKeypoint(EDGE + FLOW.crossfade, 0),
	new NumberSequenceKeypoint(1, 0),
]);

/**
 * Health capsule: flowing blood clipped to current health.
 *
 * The blood texture isn't tileable, so it's drawn as a chain of copies that
 * crossfade into each other. The chain repeats every PERIOD, so scrolling by
 * `phase = (t × speed) mod PERIOD` loops with no visible jump.
 */
export function HealthBar() {
	const fraction = useSmoothedNumber(useAtom(healthFractionAtom), HudAnimation.barSmoothing);
	const clock = useAnimationClock();
	const phase = clock.map((t) => (t * FLOW_SPEED) % PERIOD);

	return (
		<>
			<imagelabel
				key="BloodBackground"
				AnchorPoint={L.anchor}
				BackgroundTransparency={1}
				Position={L.position}
				Size={L.size}
				Image={L.background}
				ScaleType={Enum.ScaleType.Fit}
			>
				<ClippedFill fraction={fraction} insetLeft={L.fillInsetLeft} insetWidth={L.fillInsetWidth}>
					{/* The original 92.5%-wide area the blood texture is laid out in. */}
					<frame
						key="FillArea"
						BackgroundTransparency={1}
						ClipsDescendants={true}
						Position={new UDim2(L.fillInsetLeft, 0, 0, 0)}
						Size={new UDim2(L.fillInsetWidth, 0, 1, 0)}
					>
						{COPIES.map((k) => (
							<imagelabel
								key={`Blood${k}`}
								AnchorPoint={new Vector2(0, 0.5)}
								BackgroundTransparency={1}
								Position={phase.map((p) => new UDim2(k * PERIOD + p, 0, 0.5, 0))}
								Size={new UDim2(L.bloodWidth, 0, 1, 0)}
								Image={L.blood}
								ZIndex={4 + k}
							>
								<uigradient Transparency={SEAM_FADE} />
							</imagelabel>
						))}
					</frame>
				</ClippedFill>
			</imagelabel>
			<imagelabel
				key="CapsuleCover"
				AnchorPoint={L.anchor}
				BackgroundTransparency={1}
				Position={L.position}
				Size={L.size}
				Image={L.cover}
				ScaleType={Enum.ScaleType.Fit}
				ZIndex={3}
			/>
		</>
	);
}
