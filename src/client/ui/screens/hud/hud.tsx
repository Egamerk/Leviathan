import React from "@rbxts/react";
import { auxiliaryFractionAtom, staminaFractionAtom } from "client/store/stats";
import { useAtom } from "client/ui/hooks/use-atom";
import { HealthBar } from "./health-bar";
import { HudLayout } from "./hud.config";
import { OxygenBar } from "./oxygen-bar";
import { ReservoirDial } from "./reservoir-dial";
import { ResourceBar } from "./resource-bar";

/**
 * Bottom-centre vitals HUD: Oxygen, Health, Auxiliary, Stamina, Reservoir dial.
 * Its own ScreenGui with the default GUI inset. Children are laid out inside a
 * frame locked to `HudLayout.designAspectRatio`, so the HUD keeps one shape
 * at every resolution.
 */
export function Hud() {
	const auxiliary = useAtom(auxiliaryFractionAtom);
	const stamina = useAtom(staminaFractionAtom);

	return (
		<screengui key="Hud" ResetOnSpawn={false} ZIndexBehavior={Enum.ZIndexBehavior.Sibling}>
			{/* Fixed-shape frame: the layout scales as one piece instead of per-screen-axis. */}
			<frame
				key="Root"
				AnchorPoint={new Vector2(0.5, 1)}
				BackgroundTransparency={1}
				Position={UDim2.fromScale(0.5, 1)}
				Size={UDim2.fromScale(1, 1)}
			>
				<uiaspectratioconstraint
					AspectRatio={HudLayout.designAspectRatio}
					AspectType={Enum.AspectType.FitWithinMaxSize}
				/>
				<OxygenBar />
				<HealthBar />
				<ResourceBar name="Auxiliary" fraction={auxiliary} {...HudLayout.auxiliary} />
				<ResourceBar name="Stamina" fraction={stamina} {...HudLayout.stamina} />
				<ReservoirDial />
			</frame>
		</screengui>
	);
}
