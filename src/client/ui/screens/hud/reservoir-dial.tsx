import React from "@rbxts/react";
import { useAnimationClock } from "client/ui/hooks/use-animation-clock";
import { HudAnimation, HudArt, HudPieces } from "./hud.config";
import { place } from "./hud.layout";

const ART = HudArt.reservoir;

/** Centre dial: brass holder, the spinning purple Reservoir core, and the brass ring on top. */
export function ReservoirDial() {
	const clock = useAnimationClock();
	// Starts from the core's resting rotation so the first frame matches Studio.
	const coreRotation = clock.map((t) => (ART.coreRotation + t * HudAnimation.reservoirSpinDegreesPerSecond) % 360);

	return (
		<>
			<imagelabel
				key="ReservoirHolder"
				BackgroundTransparency={1}
				Image={ART.holder}
				ZIndex={-3}
				{...place(HudPieces.holder)}
			/>
			<imagelabel
				key="ReservoirCore"
				BackgroundTransparency={1}
				Image={ART.core}
				Rotation={coreRotation}
				ZIndex={-2}
				{...place(HudPieces.core)}
			/>
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
