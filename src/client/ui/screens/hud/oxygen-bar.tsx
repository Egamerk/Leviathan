import React from "@rbxts/react";
import { oxygenFractionAtom } from "client/store";
import { ClippedFill } from "client/ui/components/clipped-fill";
import { useAtom } from "client/ui/hooks/use-atom";
import { useSmoothedNumber } from "client/ui/hooks/use-smoothed-number";
import { HudAnimation, HudArt, HudPieces } from "./hud.config";
import { place } from "./hud.layout";

/** Oxygen tube. Reads `oxygenFractionAtom` (stays full until the Oxygen system exists). */
export function OxygenBar() {
	const fraction = useSmoothedNumber(useAtom(oxygenFractionAtom), HudAnimation.barSmoothing);
	return (
		<frame key="Oxygen" BackgroundTransparency={1} {...place(HudPieces.oxygen)}>
			<imagelabel key="Bar" BackgroundTransparency={1} Size={UDim2.fromScale(1, 1)} Image={HudArt.oxygen.bar} />
			<ClippedFill fraction={fraction} zIndex={1}>
				<imagelabel BackgroundTransparency={1} Size={UDim2.fromScale(1, 1)} Image={HudArt.oxygen.fill} />
			</ClippedFill>
		</frame>
	);
}
