import React from "@rbxts/react";
import { oxygenFractionAtom } from "client/store";
import { ClippedFill } from "client/ui/components/clipped-fill";
import { useAtom } from "client/ui/hooks/use-atom";
import { useSmoothedNumber } from "client/ui/hooks/use-smoothed-number";
import { HudAnimation, HudArt, HudPieces } from "./hud.config";
import { place } from "./hud.layout";

const ART = HudArt.oxygen;

/**
 * Oxygen tube: a tinted fill clipped to the tube's interior, drawn BEHIND the
 * glass so the glass shine, outline and brass caps stay on top. Reads
 * `oxygenFractionAtom` (stays full until the Oxygen system exists).
 */
export function OxygenBar() {
	const fraction = useSmoothedNumber(useAtom(oxygenFractionAtom), HudAnimation.barSmoothing);
	return (
		<frame key="Oxygen" BackgroundTransparency={1} {...place(HudPieces.oxygen)}>
			<ClippedFill
				fraction={fraction}
				insetLeft={ART.fillLeft}
				insetWidth={ART.fillRight - ART.fillLeft}
				zIndex={1}
			>
				<imagelabel
					key="Fill"
					BackgroundTransparency={1}
					Size={UDim2.fromScale(1, 1)}
					Image={ART.fill}
					ImageColor3={ART.tint}
					ImageTransparency={ART.transparency}
					ZIndex={1}
				/>
			</ClippedFill>
			<imagelabel key="Tube" BackgroundTransparency={1} Size={UDim2.fromScale(1, 1)} Image={ART.bar} ZIndex={2} />
		</frame>
	);
}
