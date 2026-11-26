import { Dependency } from "@flamework/core";
import React, { useState } from "@rbxts/react";
import { equippedToolAtom, toolsAtom } from "client/store/inventory";
import { useAtom } from "client/ui/hooks/use-atom";
import type { InventoryController } from "client/controllers/inventory/inventory.controller";
import { InventoryConfig, InventoryFonts } from "./inventory.config";
import { ItemTile } from "./item-tile";

/** Tiles per row. */
const COLUMNS = 8;
/** Gap between tiles in pixels. */
const GAP_PX = 6;
/** Room left for the scroll bar, in pixels. */
const SCROLLBAR_PX = 8;

function PanelBackground() {
	if (InventoryConfig.panelImage !== undefined) {
		return (
			<imagelabel
				key="Background"
				BackgroundTransparency={1}
				Image={InventoryConfig.panelImage}
				ScaleType={Enum.ScaleType.Slice}
				SliceCenter={InventoryConfig.panelSlice}
				Size={UDim2.fromScale(1, 1)}
				ZIndex={0}
			/>
		);
	}
	// Until InventoryPanel.png is uploaded: the same look from plain instances.
	return (
		<frame
			key="Background"
			BackgroundColor3={InventoryConfig.panelColor}
			BackgroundTransparency={InventoryConfig.panelTransparency}
			Size={UDim2.fromScale(1, 1)}
			ZIndex={0}
		>
			<uicorner CornerRadius={new UDim(0, 6)} />
			<uistroke Color={Color3.fromRGB(18, 21, 25)} Thickness={2} />
		</frame>
	);
}

/** Left-side inventory panel: every tool the player has, as a grid of tiles. */
export function InventoryPanel() {
	const tools = useAtom(toolsAtom);
	const equipped = useAtom(equippedToolAtom);
	const height = 1 - InventoryConfig.top - InventoryConfig.bottom;
	// Grid cells are sized in pixels from the list width (a scale height can't follow an automatic canvas).
	const [gridWidth, setGridWidth] = useState(0);
	const cell = math.floor((gridWidth - GAP_PX * (COLUMNS - 1)) / COLUMNS);

	return (
		<frame
			key="Panel"
			BackgroundTransparency={1}
			Position={UDim2.fromScale(InventoryConfig.left, InventoryConfig.top)}
			Size={UDim2.fromScale(1, height)}
		>
			<uiaspectratioconstraint
				AspectRatio={InventoryConfig.width / height}
				DominantAxis={Enum.DominantAxis.Height}
				AspectType={Enum.AspectType.ScaleWithParentSize}
			/>
			<PanelBackground />
			<frame key="Content" BackgroundTransparency={1} Size={UDim2.fromScale(1, 1)} ZIndex={1}>
				<uipadding
					PaddingLeft={new UDim(0.03, 0)}
					PaddingRight={new UDim(0.03, 0)}
					PaddingTop={new UDim(0.015, 0)}
					PaddingBottom={new UDim(0.015, 0)}
				/>
				<frame key="Header" BackgroundTransparency={1} Size={UDim2.fromScale(1, 0.04)}>
					<textlabel
						key="Title"
						BackgroundTransparency={1}
						FontFace={InventoryFonts.title}
						Size={UDim2.fromScale(0.7, 1)}
						Text="Tools"
						TextColor3={InventoryConfig.headerText}
						TextScaled={true}
						TextXAlignment={Enum.TextXAlignment.Left}
					/>
					<textlabel
						key="Count"
						AnchorPoint={new Vector2(1, 0)}
						BackgroundTransparency={1}
						FontFace={InventoryFonts.small}
						Position={UDim2.fromScale(1, 0.15)}
						Size={UDim2.fromScale(0.2, 0.7)}
						Text={tostring(tools.size())}
						TextColor3={InventoryConfig.mutedText}
						TextScaled={true}
						TextXAlignment={Enum.TextXAlignment.Right}
					/>
				</frame>
				<frame
					key="Divider"
					BackgroundColor3={InventoryConfig.divider}
					BackgroundTransparency={0.5}
					BorderSizePixel={0}
					Position={UDim2.fromScale(0, 0.045)}
					Size={new UDim2(1, 0, 0, 1)}
				/>
				<scrollingframe
					key="Items"
					AutomaticCanvasSize={Enum.AutomaticSize.Y}
					BackgroundTransparency={1}
					BorderSizePixel={0}
					CanvasSize={new UDim2()}
					Position={UDim2.fromScale(0, 0.055)}
					ScrollBarImageColor3={InventoryConfig.mutedText}
					ScrollBarThickness={4}
					ScrollingDirection={Enum.ScrollingDirection.Y}
					Size={UDim2.fromScale(1, 0.945)}
					Change={{ AbsoluteSize: (rbx) => setGridWidth(rbx.AbsoluteSize.X - SCROLLBAR_PX) }}
				>
					<uipadding PaddingRight={new UDim(0, SCROLLBAR_PX)} PaddingTop={new UDim(0, 4)} />
					<uigridlayout
						CellPadding={UDim2.fromOffset(GAP_PX, GAP_PX)}
						CellSize={UDim2.fromOffset(cell, cell)}
						SortOrder={Enum.SortOrder.LayoutOrder}
					/>
					{tools.map((tool, index) => (
						<ItemTile
							key={`Item${index}`}
							tool={tool}
							equipped={tool === equipped}
							layoutOrder={index}
							onActivate={() => Dependency<InventoryController>().toggleEquip(tool)}
						/>
					))}
				</scrollingframe>
			</frame>
		</frame>
	);
}
