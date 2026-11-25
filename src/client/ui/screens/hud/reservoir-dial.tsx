import React from "@rbxts/react";
import { reservoirFractionAtom } from "client/store/stats";
import { useAnimationClock } from "client/ui/hooks/use-animation-clock";
import { useAtom } from "client/ui/hooks/use-atom";
import { useSmoothedNumber } from "client/ui/hooks/use-smoothed-number";
import { HudAnimation, HudArt, HudPieces, RESERVOIR_VISIBLE_FRACTION } from "./hud.config";
import { place, rect } from "./hud.layout";

const ART = HudArt.reservoir;
const MIN_LEVEL = 1e-3;

/**
 * Centre dial: brass holder, the purple Reservoir liquid, and the brass ring.
 *
 * The liquid spins and fills the chamber from the bottom up to the current
 * Reservoir. The clip is a CanvasGroup, because plain ClipsDescendants doesn't
 * clip rotated children reliably.
 */
export function ReservoirDial() {
	const clock = useAnimationClock();
	const coreRotation = clock.map((t) => (ART.coreRotation + t * HudAnimation.reservoirSpinDegreesPerSecond) % 360);
	const level = useSmoothedNumber(useAtom(reservoirFractionAtom), HudAnimation.barSmoothing);
	// Visible height of the liquid, as a fraction of the disc's full height.
	const boxFraction = level.map((f) => math.max(f * RESERVOIR_VISIBLE_FRACTION, MIN_LEVEL));
	const core = rect(HudPieces.core);

	return (
		<>
			<imagelabel
				key="ReservoirHolder"
				BackgroundTransparency={1}
				Image={ART.holder}
				ZIndex={-3}
				{...place(HudPieces.holder)}
			/>
			<canvasgroup
				key="ReservoirLiquid"
				AnchorPoint={new Vector2(0.5, 1)}
				BackgroundTransparency={1}
				Position={UDim2.fromScale(core.x, core.y + core.height / 2)}
				Size={boxFraction.map((b) => UDim2.fromScale(core.width, core.height * b))}
				Visible={level.map((f) => f > MIN_LEVEL)}
				ZIndex={-2}
			>
				<imagelabel
					key="Core"
					AnchorPoint={new Vector2(0.5, 1)}
					BackgroundTransparency={1}
					Image={ART.core}
					Position={UDim2.fromScale(0.5, 1)}
					Rotation={coreRotation}
					Size={boxFraction.map((b) => UDim2.fromScale(1, 1 / b))}
				/>
			</canvasgroup>
			<imagelabel
				key="ReservoirWheel"
				BackgroundTransparency={1}
				Image={ART.wheel}
				ZIndex={-1}
				{...place(HudPieces.wheel)}
			/>
		</>
	);
}
