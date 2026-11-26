import { Dependency } from "@flamework/core";
import React, { useState } from "@rbxts/react";
import { equippedToolAtom, toolsAtom } from "client/store/inventory";
import { useAtom } from "client/ui/hooks/use-atom";
import type { InventoryController } from "client/controllers/inventory/inventory.controller";
import { InventoryConfig, InventoryFonts } from "./inventory.config";
import { ItemTile } from "./item-tile";

/** Tiles per row. */
const COLUMNS = 9;
/** Gap between tiles in pixels. */
const GAP_PX = 6;
/** Padding inside the item group box, in pixels. */
const GROUP_PAD_PX = 5;
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
	const cell = math.floor((gridWidth - 2 * GROUP_PAD_PX - GAP_PX * (COLUMNS - 1)) / COLUMNS);

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
				<scrollingframe
					key="Sections"
					AutomaticCanvasSize={Enum.AutomaticSize.Y}
					BackgroundTransparency={1}
					BorderSizePixel={0}
					CanvasSize={new UDim2()}
					ScrollBarImageColor3={InventoryConfig.mutedText}
					ScrollBarThickness={4}
					ScrollingDirection={Enum.ScrollingDirection.Y}
					Size={UDim2.fromScale(1, 1)}
					Change={{ AbsoluteSize: (rbx) => setGridWidth(rbx.AbsoluteSize.X - SCROLLBAR_PX) }}
				>
					<uipadding PaddingRight={new UDim(0, SCROLLBAR_PX)} />
					<uilistlayout SortOrder={Enum.SortOrder.LayoutOrder} Padding={new UDim(0, 4)} />
					<frame
						key="Header"
						BackgroundTransparency={1}
						LayoutOrder={1}
						Size={new UDim2(1, 0, 0, cell * 0.42)}
					>
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
							AnchorPoint={new Vector2(1, 0.5)}
							BackgroundTransparency={1}
							FontFace={InventoryFonts.small}
							Position={new UDim2(1, -cell * 0.42, 0.5, 0)}
							Size={UDim2.fromScale(0.2, 0.6)}
							Text={tostring(tools.size())}
							TextColor3={InventoryConfig.mutedText}
							TextScaled={true}
							TextXAlignment={Enum.TextXAlignment.Right}
						/>
						{/* Collapse chevron box, as in the reference (not interactive yet). */}
						<frame
							key="Chevron"
							AnchorPoint={new Vector2(1, 0.5)}
							BackgroundColor3={InventoryConfig.groupColor}
							BackgroundTransparency={0.4}
							Position={UDim2.fromScale(1, 0.5)}
							Size={UDim2.fromScale(0.8, 0.8)}
						>
							<uiaspectratioconstraint AspectRatio={1} />
							<uistroke Color={InventoryConfig.groupEdge} Thickness={1} />
							<textlabel
								BackgroundTransparency={1}
								FontFace={Font.fromEnum(Enum.Font.GothamBold)}
								Rotation={90}
								Size={UDim2.fromScale(0.7, 0.7)}
								AnchorPoint={new Vector2(0.5, 0.5)}
								Position={UDim2.fromScale(0.5, 0.5)}
								Text=">"
								TextColor3={InventoryConfig.headerText}
								TextScaled={true}
							/>
						</frame>
					</frame>
					<frame
						key="Divider"
						BackgroundColor3={InventoryConfig.divider}
						BackgroundTransparency={0.5}
						BorderSizePixel={0}
						LayoutOrder={2}
						Size={new UDim2(1, 0, 0, 1)}
					/>
					<textlabel
						key="Group"
						BackgroundTransparency={1}
						FontFace={InventoryFonts.small}
						LayoutOrder={3}
						Size={new UDim2(1, 0, 0, math.max(cell * 0.2, 8))}
						Text="ITEMS"
						TextColor3={InventoryConfig.mutedText}
						TextScaled={true}
						TextXAlignment={Enum.TextXAlignment.Left}
					/>
					<frame
						key="Items"
						AutomaticSize={Enum.AutomaticSize.Y}
						BackgroundColor3={InventoryConfig.groupColor}
						BackgroundTransparency={InventoryConfig.groupTransparency}
						LayoutOrder={4}
						Size={UDim2.fromScale(1, 0)}
					>
						<uicorner CornerRadius={new UDim(0, 3)} />
						<uistroke Color={InventoryConfig.groupEdge} Thickness={1} Transparency={0.3} />
						<uipadding
							PaddingLeft={new UDim(0, GROUP_PAD_PX)}
							PaddingRight={new UDim(0, GROUP_PAD_PX)}
							PaddingTop={new UDim(0, GROUP_PAD_PX)}
							PaddingBottom={new UDim(0, GROUP_PAD_PX)}
						/>
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
					</frame>
				</scrollingframe>
			</frame>
		</frame>
	);
}
