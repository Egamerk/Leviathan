import React, { useEffect, useState } from "@rbxts/react";
import { oxygenFractionAtom, vitalsAtom } from "client/store";
import { localStatsAtom } from "client/store/stats";
import { useAtom } from "client/ui/hooks/use-atom";
import { useSmoothedNumber } from "client/ui/hooks/use-smoothed-number";
import { HudArt, HudPieces, type Piece } from "./hud.config";
import { rect } from "./hud.layout";
import { type HudElement, tooltipFor } from "./hud.tooltips";

const STYLE = HudArt.tooltip;

/** The piece each element's tooltip is centred over. */
const ANCHOR: Record<HudElement, Piece> = {
	oxygen: HudPieces.oxygen,
	health: HudPieces.health,
	auxiliary: HudPieces.auxiliary,
	stamina: HudPieces.stamina,
	reservoir: HudPieces.core,
};

/**
 * Tooltip above the HUD, horizontally over the hovered element, so it never
 * covers the bars. Fades in and out; keeps showing the last element while it
 * fades out.
 */
export function HudTooltip({ hovered }: { hovered?: HudElement }) {
	const vitals = useAtom(vitalsAtom);
	const stats = useAtom(localStatsAtom);
	const oxygen = useAtom(oxygenFractionAtom);
	const [shown, setShown] = useState<HudElement | undefined>(hovered);
	useEffect(() => {
		if (hovered !== undefined) setShown(hovered);
	}, [hovered]);
	const opacity = useSmoothedNumber(hovered !== undefined ? 1 : 0, STYLE.fadeSpeed);
	if (shown === undefined) return undefined;

	const content = tooltipFor(shown, { vitals, stats, oxygen });
	const x = rect(ANCHOR[shown]).x;
	const text = (key: string, value: string, font: Font, size: number, color: Color3, order: number) => (
		<textlabel
			key={key}
			AutomaticSize={Enum.AutomaticSize.Y}
			BackgroundTransparency={1}
			FontFace={font}
			LayoutOrder={order}
			RichText={false}
			Size={UDim2.fromScale(1, 0)}
			Text={value}
			TextColor3={color}
			TextSize={size}
			TextWrapped={true}
			TextXAlignment={Enum.TextXAlignment.Left}
		/>
	);

	return (
		<canvasgroup
			key="Tooltip"
			AnchorPoint={new Vector2(0.5, 1)}
			AutomaticSize={Enum.AutomaticSize.Y}
			BackgroundColor3={STYLE.background}
			BorderSizePixel={0}
			GroupTransparency={opacity.map((o) => 1 - o)}
			Position={new UDim2(x, 0, 0, -STYLE.gap)}
			Size={UDim2.fromOffset(STYLE.width, 0)}
			Visible={opacity.map((o) => o > 0.01)}
			ZIndex={50}
		>
			<uicorner CornerRadius={new UDim(0, 6)} />
			<uistroke Color={STYLE.border} Thickness={1.5} />
			<uipadding
				PaddingLeft={new UDim(0, 12)}
				PaddingRight={new UDim(0, 12)}
				PaddingTop={new UDim(0, 9)}
				PaddingBottom={new UDim(0, 10)}
			/>
			<uilistlayout Padding={new UDim(0, 4)} SortOrder={Enum.SortOrder.LayoutOrder} />
			<frame
				key="Header"
				AutomaticSize={Enum.AutomaticSize.Y}
				BackgroundTransparency={1}
				LayoutOrder={1}
				Size={UDim2.fromScale(1, 0)}
			>
				{text("Title", content.title, STYLE.titleFont, 18, content.accent, 1)}
				<textlabel
					key="Value"
					AnchorPoint={new Vector2(1, 0)}
					BackgroundTransparency={1}
					FontFace={STYLE.titleFont}
					Position={UDim2.fromScale(1, 0)}
					Size={UDim2.fromScale(0.5, 1)}
					Text={content.value}
					TextColor3={STYLE.text}
					TextSize={18}
					TextXAlignment={Enum.TextXAlignment.Right}
				/>
			</frame>
			<frame
				key="Rule"
				BackgroundColor3={STYLE.border}
				BackgroundTransparency={0.5}
				BorderSizePixel={0}
				LayoutOrder={2}
				Size={new UDim2(1, 0, 0, 1)}
			/>
			{text("Description", content.description, STYLE.bodyFont, 14, STYLE.text, 3)}
			{text("Detail", content.detail, STYLE.bodyFont, 13, STYLE.muted, 4)}
		</canvasgroup>
	);
}
