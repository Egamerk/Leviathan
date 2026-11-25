import React from "@rbxts/react";
import { oxygenFractionAtom } from "client/store";
import { ClippedFill } from "client/ui/components/clipped-fill";
import { useAtom } from "client/ui/hooks/use-atom";
import { useSmoothedNumber } from "client/ui/hooks/use-smoothed-number";
import { HudAnimation, HudArt, HudPieces, USE_OXYGEN_TUBE } from "./hud.config";
import { place } from "./hud.layout";
import { ResourceBar } from "./resource-bar";

const ART = HudArt.oxygen;
const TUBE = HudArt.oxygenTube;

/**
 * Oxygen. With the new tube art it's the same flowing-liquid tube as
 * Auxiliary / Stamina (caps on both ends, no point dividers). Otherwise it
 * falls back to the thin original bar: a tinted fill behind the glass.
 * Reads `oxygenFractionAtom` (stays full until the Oxygen system exists).
 */
export function OxygenBar() {
	const value = useAtom(oxygenFractionAtom);
	const fraction = useSmoothedNumber(value, HudAnimation.barSmoothing);

	if (USE_OXYGEN_TUBE) {
		return (
			<ResourceBar
				name="Oxygen"
				fraction={value}
				points={0}
				piece={HudPieces.oxygen}
				art={{ ...TUBE, back: TUBE.back!, glass: TUBE.glass!, flowTile: TUBE.flowTile! }}
				flowDirection={1}
			/>
		);
	}

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
