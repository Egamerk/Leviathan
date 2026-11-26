import { Controller, OnStart } from "@flamework/core";
import Log from "@rbxts/log";
import { ContextActionService, Players, StarterGui } from "@rbxts/services";
import type { OnCharacterAdded } from "client/lifecycles";
import { equippedToolAtom, inventoryOpenAtom, toolsAtom } from "client/store/inventory";
import { HotbarConfig, InventoryConfig } from "client/ui/screens/inventory/inventory.config";

const SLOT_KEYS: Enum.KeyCode[] = [
	Enum.KeyCode.One,
	Enum.KeyCode.Two,
	Enum.KeyCode.Three,
	Enum.KeyCode.Four,
	Enum.KeyCode.Five,
	Enum.KeyCode.Six,
	Enum.KeyCode.Seven,
	Enum.KeyCode.Eight,
	Enum.KeyCode.Nine,
	Enum.KeyCode.Zero,
];

/**
 * Replaces Roblox's default backpack. Tracks the player's Tools (Backpack +
 * equipped) into `toolsAtom` in the order they were received, binds the
 * hotbar keys (1–9, 0) and the inventory toggle (`), and equips / unequips.
 */
@Controller()
export class InventoryController implements OnStart, OnCharacterAdded {
	private readonly logger = Log.ForContext(InventoryController);
	private readonly player = Players.LocalPlayer;
	private character?: Model;
	private readonly watched = new Map<Tool, RBXScriptConnection>();

	public onStart(): void {
		this.disableDefaultBackpack();

		this.player.ChildAdded.Connect((child) => {
			if (child.IsA("Backpack")) this.watchContainer(child);
		});
		const backpack = this.player.FindFirstChildOfClass("Backpack");
		if (backpack) this.watchContainer(backpack);

		ContextActionService.BindAction(
			"InventoryHotbar",
			(_, state, input) => {
				if (state !== Enum.UserInputState.Begin) return Enum.ContextActionResult.Pass;
				const index = SLOT_KEYS.indexOf(input.KeyCode);
				if (index === -1 || index >= HotbarConfig.slots) return Enum.ContextActionResult.Pass;
				this.toggleEquip(toolsAtom()[index]);
				return Enum.ContextActionResult.Sink;
			},
			false,
			...SLOT_KEYS,
		);
		ContextActionService.BindAction(
			"InventoryToggle",
			(_, state) => {
				if (state !== Enum.UserInputState.Begin) return Enum.ContextActionResult.Pass;
				inventoryOpenAtom((open) => !open);
				return Enum.ContextActionResult.Sink;
			},
			false,
			InventoryConfig.toggleKey,
		);
	}

	public onCharacterAdded(character: Model): void {
		this.character = character;
		this.watchContainer(character);
	}

	/** Equips `tool`, or unequips it if it is already in hand. */
	public toggleEquip(tool: Tool | undefined): void {
		const humanoid = this.character?.FindFirstChildOfClass("Humanoid");
		if (!tool || !humanoid || humanoid.Health <= 0) return;
		if (tool.Parent === this.character) humanoid.UnequipTools();
		else humanoid.EquipTool(tool);
	}

	/** The core backpack can't be disabled until the core scripts have loaded, so retry briefly. */
	private disableDefaultBackpack(): void {
		task.spawn(() => {
			for (let attempt = 0; attempt < 20; attempt++) {
				const [ok] = pcall(() => StarterGui.SetCoreGuiEnabled(Enum.CoreGuiType.Backpack, false));
				if (ok) return;
				task.wait(0.25);
			}
			this.logger.Warn("Could not disable the default backpack");
		});
	}

	private watchContainer(container: Instance): void {
		for (const child of container.GetChildren()) if (child.IsA("Tool")) this.track(child);
		container.ChildAdded.Connect((child) => {
			if (child.IsA("Tool")) this.track(child);
		});
		container.ChildRemoved.Connect(() => this.refreshEquipped());
		this.refreshEquipped();
	}

	private isHeld(tool: Tool): boolean {
		const parent = tool.Parent;
		return parent !== undefined && (parent === this.character || parent.IsA("Backpack"));
	}

	private track(tool: Tool): void {
		if (!this.watched.has(tool)) {
			this.watched.set(
				tool,
				tool.AncestryChanged.Connect(() => {
					// Backpack ⇄ character moves reparent through a frame; check once it settles.
					task.defer(() => {
						if (this.isHeld(tool)) return;
						this.watched.get(tool)?.Disconnect();
						this.watched.delete(tool);
						toolsAtom((tools) => tools.filter((t) => t !== tool));
						this.refreshEquipped();
					});
				}),
			);
			toolsAtom((tools) => [...tools, tool]);
		}
		this.refreshEquipped();
	}

	private refreshEquipped(): void {
		equippedToolAtom(this.character?.FindFirstChildOfClass("Tool"));
	}
}
