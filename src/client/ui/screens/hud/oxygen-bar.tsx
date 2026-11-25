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
const LABEL_FONT = HudArt.healthText.font;
const LABEL_INK = Color3.fromRGB(28, 62, 84);
const LABEL_STROKE = Color3.fromRGB(220, 244, 252);

/**
 * "O₂" drawn as a big O and a small, lowered 2 (Roblox fonts may lack the
 * subscript glyph), sitting inside the tube next to the left cap.
 */
function OxygenLabel() {
	// Fractions of the tube frame. A box h tall and h·k wide (in pixels) is
	// h·k / aspect wide in width fractions, where aspect = tube width ÷ height.
	const aspect = HudPieces.oxygen.aspect;
	const widthFor = (h: number, k: number) => (h * k) / aspect;
	const height = (TUBE.fillBottom - TUBE.fillTop) * 0.62;
	const top = TUBE.fillTop + (TUBE.fillBottom - TUBE.fillTop - height) / 2;
	const letter = (key: string, text: string, x: number, y: number, h: number) => (
		<textlabel
			key={key}
			BackgroundTransparency={1}
			FontFace={LABEL_FONT}
			Position={UDim2.fromScale(x, y)}
			Size={UDim2.fromScale(widthFor(h, 1.2), h)}
			Text={text}
			TextColor3={LABEL_INK}
			TextScaled={true}
			TextXAlignment={Enum.TextXAlignment.Left}
			ZIndex={4}
		>
			<uistroke Color={LABEL_STROKE} Thickness={1} />
		</textlabel>
	);
	const x = TUBE.fillLeft + 0.012;
	const oWidth = widthFor(height, 1.05);
	return (
		<frame key="Label" BackgroundTransparency={1} Size={UDim2.fromScale(1, 1)} ZIndex={4}>
			{letter("O", "O", x, top, height)}
			{letter("Two", "2", x + oWidth, top + height * 0.45, height * 0.55)}
		</frame>
	);
}

/**
 * Oxygen. With the new tube art it's the same flowing tube as Auxiliary /
 * Stamina (caps on both ends, no point dividers), filled with gas and rising
 * bubbles, plus an "O₂" label. Otherwise it falls back to the thin original
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
					<frame key="OxygenLabel" BackgroundTransparency={1} ZIndex={3} {...place(HudPieces.oxygen)}>
						<OxygenLabel />
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
