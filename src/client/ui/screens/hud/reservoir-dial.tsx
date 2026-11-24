import React from "@rbxts/react";
import { useAnimationClock } from "client/ui/hooks/use-animation-clock";
import { HudAnimation, HudLayout } from "./hud.config";

const L = HudLayout.reservoir;

/** Centre piece: holder, the spinning wheel, and the flipped inner core. Draw order matches Studio. */
export function ReservoirDial() {
	const clock = useAnimationClock();
	const rotation = clock.map((t) => (t * HudAnimation.reservoirSpinDegreesPerSecond) % 360);

	return (
		<>
			<imagelabel
				key="ReservoirHolder"
				AnchorPoint={L.anchor}
				BackgroundTransparency={1}
				Position={L.position}
				Size={L.size}
				Image={L.holder}
				ScaleType={Enum.ScaleType.Fit}
				ZIndex={-3}
			/>
			<imagelabel
				key="ReservoirCore"
				AnchorPoint={L.anchor}
				BackgroundTransparency={1}
				Position={L.corePosition}
				Size={L.coreSize}
				Rotation={L.coreRotation}
				Image={L.core}
				ScaleType={Enum.ScaleType.Fit}
				ZIndex={-2}
			/>
			<imagelabel
				key="ReservoirWheel"
				AnchorPoint={L.anchor}
				BackgroundTransparency={1}
				Position={L.position}
				Size={L.size}
				Rotation={rotation}
				Image={L.wheel}
				ScaleType={Enum.ScaleType.Fit}
				ZIndex={-1}
			/>
		</>
	);
}
