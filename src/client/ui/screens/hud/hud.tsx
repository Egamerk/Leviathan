import React, { useState } from "@rbxts/react";
import { auxiliaryFractionAtom, localStatsAtom, staminaFractionAtom } from "client/store/stats";
import { useAtom } from "client/ui/hooks/use-atom";
import { HealthBar } from "./health-bar";
import { HoverZone } from "./hover-zone";
import type { HudElement } from "./hud.format";
import { HudAnimation, HudArt, HudPieces, HudPlacement } from "./hud.config";
import { CLUSTER_ASPECT } from "./hud.layout";
import { OxygenBar } from "./oxygen-bar";
import { ReservoirDial } from "./reservoir-dial";
import { ResourceBar } from "./resource-bar";

/**
 * Bottom-centre vitals HUD: Oxygen, Health, Auxiliary, Stamina and the
 * Reservoir dial, laid out in one cluster frame. The cluster's height is a
 * fraction of the screen and its width follows its fixed aspect ratio, so the
 * HUD looks identical on every resolution and aspect (16:9, 16:10, ultrawide).
 */
export function Hud() {
	const auxiliary = useAtom(auxiliaryFractionAtom);
	const stamina = useAtom(staminaFractionAtom);
	const stats = useAtom(localStatsAtom);
	const [hovered, setHovered] = useState<HudElement | undefined>(undefined);
	const onHover = (element: HudElement | undefined, toggle?: boolean) =>
		setHovered((current) => (toggle ? (current === element ? undefined : element) : element));

	return (
		<screengui key="Hud" ResetOnSpawn={false} ZIndexBehavior={Enum.ZIndexBehavior.Sibling}>
			<frame
				key="Cluster"
				AnchorPoint={new Vector2(0.5, 1)}
				BackgroundTransparency={1}
				Position={UDim2.fromScale(0.5, 1 - HudPlacement.bottomPadding)}
				Size={UDim2.fromScale(1, HudPlacement.height)}
			>
				<uiaspectratioconstraint AspectRatio={CLUSTER_ASPECT} AspectType={Enum.AspectType.FitWithinMaxSize} />
				<OxygenBar hovered={hovered === "oxygen"} />
				<HealthBar hovered={hovered === "health"} />
				<ResourceBar
					name="Auxiliary"
					fraction={auxiliary}
					points={stats?.maxAuxiliary ?? 2}
					piece={HudPieces.auxiliary}
					art={HudArt.auxiliary}
					flowDirection={HudAnimation.auxiliaryFlowDirection * HudAnimation.auxiliaryFlowSpeed}
					hovered={hovered === "auxiliary"}
				/>
				<ResourceBar
					name="Stamina"
					fraction={stamina}
					points={stats?.maxStamina ?? 4}
					piece={HudPieces.stamina}
					art={HudArt.stamina}
					flowDirection={HudAnimation.staminaFlowDirection * HudAnimation.staminaFlowSpeed}
					hovered={hovered === "stamina"}
				/>
				<ReservoirDial hovered={hovered === "reservoir"} />
				<HoverZone element="oxygen" piece={HudPieces.oxygen} onHover={onHover} />
				<HoverZone element="health" piece={HudPieces.health} onHover={onHover} />
				<HoverZone element="auxiliary" piece={HudPieces.auxiliary} onHover={onHover} />
				<HoverZone element="stamina" piece={HudPieces.stamina} onHover={onHover} />
				<HoverZone element="reservoir" piece={HudPieces.core} pad={0.15} onHover={onHover} />
			</frame>
		</screengui>
	);
}
