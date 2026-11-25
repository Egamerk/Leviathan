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
const TEXT = HudArt.healthText;
const INK = Color3.fromRGB(24, 52, 74);
const STROKE = Color3.fromRGB(228, 246, 252);

/** "O₂ 100%" centred on the tube: same font as the health readout, dark ink for the pale gas. */
function OxygenReadout({ fraction }: { fraction: number }) {
	return (
		<textlabel
			key="Readout"
			AnchorPoint={new Vector2(0.5, 0.5)}
			BackgroundTransparency={1}
			FontFace={TEXT.font}
			Position={UDim2.fromScale(0.5, 0.5)}
			Size={UDim2.fromScale(0.5, 0.62)}
			Text={`O₂ ${math.round(fraction * 100)}%`}
			TextColor3={INK}
			TextScaled={true}
			ZIndex={4}
		>
			<uistroke Color={STROKE} Thickness={1.5} />
		</textlabel>
	);
}

/**
 * Oxygen. With the new tube art it's the same flowing tube as Auxiliary /
 * Stamina (caps on both ends, no point dividers), filled with gas and rising
 * bubbles, plus an "O₂ 100%" readout. Otherwise it falls back to the thin original
 * bar. Reads `oxygenFractionAtom` (stays full until the Oxygen system exists).
 */
export function OxygenBar() {
	const value = useAtom(oxygenFractionAtom);
	const fraction = useSmoothedNumber(value, HudAnimation.barSmoothing);

	if (USE_OXYGEN_TUBE) {
		return (
			<>
				<ResourceBar
					name="Oxygen"
					fraction={value}
					points={0}
					piece={HudPieces.oxygen}
					art={{ ...TUBE, back: TUBE.back!, glass: TUBE.glass!, flowTile: TUBE.flowTile! }}
					flowDirection={1}
				/>
				{TUBE.label && (
					<frame key="OxygenReadout" BackgroundTransparency={1} ZIndex={3} {...place(HudPieces.oxygen)}>
						<OxygenReadout fraction={value} />
					</frame>
				)}
			</>
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
