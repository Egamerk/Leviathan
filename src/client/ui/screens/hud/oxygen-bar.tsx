import React from "@rbxts/react";
import { oxygenFractionAtom } from "client/store";
import { ClippedFill } from "client/ui/components/clipped-fill";
import { useAtom } from "client/ui/hooks/use-atom";
import { useSmoothedNumber } from "client/ui/hooks/use-smoothed-number";
import { HudAnimation, HudLayout } from "./hud.config";

const L = HudLayout.oxygen;

/** Oxygen capsule. Reads `oxygenFractionAtom` (stays full until the Oxygen system exists). */
export function OxygenBar() {
	const fraction = useSmoothedNumber(useAtom(oxygenFractionAtom), HudAnimation.barSmoothing);
	return (
		<frame key="Oxygen" AnchorPoint={L.anchor} BackgroundTransparency={1} Position={L.position} Size={L.size}>
			<imagelabel
				key="OxygenBar"
				BackgroundTransparency={1}
				Size={UDim2.fromScale(1, 1)}
				Image={L.bar}
				ZIndex={0}
			/>
			<ClippedFill fraction={fraction} zIndex={1}>
				<imagelabel BackgroundTransparency={1} Size={UDim2.fromScale(1, 1)} Image={L.fill} />
			</ClippedFill>
		</frame>
	);
}
