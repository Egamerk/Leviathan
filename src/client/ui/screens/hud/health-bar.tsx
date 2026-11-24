import React from "@rbxts/react";
import { healthFractionAtom } from "client/store/stats";
import { ClippedFill } from "client/ui/components/clipped-fill";
import { useAnimationClock } from "client/ui/hooks/use-animation-clock";
import { useAtom } from "client/ui/hooks/use-atom";
import { useSmoothedNumber } from "client/ui/hooks/use-smoothed-number";
import { HudAnimation, HudLayout } from "./hud.config";

const L = HudLayout.health;
const FLOW = HudAnimation.healthFlow;

/** Health capsule: flowing blood texture, clipped to current health. */
export function HealthBar() {
	const fraction = useSmoothedNumber(useAtom(healthFractionAtom), HudAnimation.barSmoothing);
	const clock = useAnimationClock();
	const bloodX = clock.map((t) => FLOW.from + ((t % FLOW.seconds) / FLOW.seconds) * (FLOW.to - FLOW.from));

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
						Position={new UDim2(L.fillInsetLeft, 0, 0, 0)}
						Size={new UDim2(L.fillInsetWidth, 0, 1, 0)}
					>
						<imagelabel
							key="Blood"
							AnchorPoint={L.bloodAnchor}
							BackgroundTransparency={1}
							Position={bloodX.map((x) => new UDim2(x, 0, 0.5, 0))}
							Size={L.bloodSize}
							Image={L.blood}
							ZIndex={2}
						/>
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
