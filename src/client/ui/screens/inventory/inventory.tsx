import React from "@rbxts/react";
import { inventoryOpenAtom } from "client/store/inventory";
import { useAtom } from "client/ui/hooks/use-atom";
import { Hotbar } from "./hotbar";
import { InventoryPanel } from "./inventory-panel";

/** Hotbar (always) and the left inventory panel (toggled with `). Replaces Roblox's backpack. */
export function Inventory() {
	const open = useAtom(inventoryOpenAtom);
	return (
		<screengui key="Inventory" ResetOnSpawn={false} ZIndexBehavior={Enum.ZIndexBehavior.Sibling}>
			<Hotbar />
			{open && <InventoryPanel />}
		</screengui>
	);
}
