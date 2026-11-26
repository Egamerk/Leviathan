import { Dependency } from "@flamework/core";
import React from "@rbxts/react";
import { equippedToolAtom, toolsAtom } from "client/store/inventory";
import { useAtom } from "client/ui/hooks/use-atom";
import type { InventoryController } from "client/controllers/inventory/inventory.controller";
import { HotbarConfig } from "./inventory.config";
import { ItemTile } from "./item-tile";

const KEY_LABELS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

/**
 * Bottom hotbar above the vitals HUD. Only slots that hold an item are drawn,
 * and the row is centred on screen, so it grows from the middle as items are added.
 */
export function Hotbar() {
	const tools = useAtom(toolsAtom);
	const equipped = useAtom(equippedToolAtom);
	const shown = tools.filter((_, i) => i < HotbarConfig.slots);
	const slotScale = 1 / (1 + HotbarConfig.gap);

	return (
		<frame
			key="Hotbar"
			AnchorPoint={new Vector2(0.5, 1)}
			BackgroundTransparency={1}
			Position={UDim2.fromScale(0.5, 1 - HotbarConfig.bottom)}
			Size={UDim2.fromScale(1, HotbarConfig.slotSize)}
		>
			<uilistlayout
				FillDirection={Enum.FillDirection.Horizontal}
				HorizontalAlignment={Enum.HorizontalAlignment.Center}
				VerticalAlignment={Enum.VerticalAlignment.Bottom}
				SortOrder={Enum.SortOrder.LayoutOrder}
			/>
			{shown.map((tool, index) => (
				// Each holder is a slot plus its share of the gap, so spacing scales with the slot.
				<frame
					key={`Slot${index + 1}`}
					BackgroundTransparency={1}
					LayoutOrder={index}
					Size={UDim2.fromScale(1, 1)}
				>
					<uiaspectratioconstraint
						AspectRatio={1 + HotbarConfig.gap}
						DominantAxis={Enum.DominantAxis.Height}
					/>
					<frame
						AnchorPoint={new Vector2(0.5, 1)}
						BackgroundTransparency={1}
						Position={UDim2.fromScale(0.5, 1)}
						Size={UDim2.fromScale(slotScale, 1)}
					>
						<ItemTile
							tool={tool}
							equipped={tool === equipped}
							keyLabel={KEY_LABELS[index]}
							onActivate={() => Dependency<InventoryController>().toggleEquip(tool)}
						/>
					</frame>
				</frame>
			))}
		</frame>
	);
}
