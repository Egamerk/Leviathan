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
 * Its own ScreenGui with the default GUI inset, so Scale positions match the
 * Studio layout exactly.
 */
export function Hud() {
	const auxiliary = useAtom(auxiliaryFractionAtom);
	const stamina = useAtom(staminaFractionAtom);

	return (
		<screengui key="Hud" ResetOnSpawn={false} ZIndexBehavior={Enum.ZIndexBehavior.Sibling}>
			<OxygenBar />
			<HealthBar />
			<ResourceBar name="Auxiliary" fraction={auxiliary} {...HudLayout.auxiliary} />
			<ResourceBar name="Stamina" fraction={stamina} {...HudLayout.stamina} />
			<ReservoirDial />
		</screengui>
	);
}
