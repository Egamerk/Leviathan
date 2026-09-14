import { Players } from "@rbxts/services";
import { subscribe } from "@rbxts/charm";
import type { EncounterCombatantSnapshot, EncounterSnapshot } from "shared/net/types";
import { combatantAtom } from "shared/state/combat";
import {
	cancelCombatIntent,
	clearCombatIntent,
	combatIntentAtom,
	selectAttackAbility,
	selectMoveMode,
} from "shared/state/combatIntent";
import { encounterAtom } from "shared/state/encounter";
import { evadeWindowAtom } from "shared/state/evade";
import { confirmCombatIntent, endPlayerTurn } from "client/controllers/combat";

const TELEGRAPH = Color3.fromRGB(220, 180, 40);
const OPEN_PARRY = Color3.fromRGB(70, 160, 255);
const OPEN_DODGE = Color3.fromRGB(90, 220, 120);
const SUCCESS = Color3.fromRGB(80, 220, 100);
const MISS = Color3.fromRGB(220, 70, 70);
const IDLE = Color3.fromRGB(20, 20, 24);
const BTN_IDLE = Color3.fromRGB(28, 32, 40);
const BTN_ACTIVE = Color3.fromRGB(55, 90, 160);
const BTN_DISABLED = Color3.fromRGB(22, 24, 28);

const HINT_IDLE = "Click the ground to move · click the enemy to attack · RMB orbit · WASD pan · Q/E evade";

function turnBanner(snapshot: EncounterSnapshot | undefined): string {
	if (snapshot === undefined) return "Waiting for encounter…";
	if (snapshot.phase === "complete") {
		const player = snapshot.combatants.find((c) => c.kind === "player");
		const enemy = snapshot.combatants.find((c) => c.kind === "enemy");
		if (player !== undefined && player.health.current <= 0) return `Round ${snapshot.round} — Defeat`;
		if (enemy !== undefined && enemy.health.current <= 0) return `Round ${snapshot.round} — Victory!`;
		return `Round ${snapshot.round} — Complete`;
	}
	if (snapshot.phase === "resolvingEvade" || snapshot.phase === "enemyAttack") {
		return `Round ${snapshot.round} — ENEMY TURN (evade!)`;
	}
	if (snapshot.actor === "player" || snapshot.phase === "awaitingAction") {
		return `Round ${snapshot.round} — YOUR TURN`;
	}
	if (snapshot.actor === "enemy") {
		return `Round ${snapshot.round} — ENEMY TURN`;
	}
	return `Round ${snapshot.round}`;
}

function localPlayerSnap(snapshot: EncounterSnapshot | undefined): EncounterCombatantSnapshot | undefined {
	return snapshot?.combatants.find((c) => c.kind === "player");
}

function makeLabel(parent: Instance, name: string, size: UDim2, order: number, textSize: number): TextLabel {
	const label = new Instance("TextLabel");
	label.Name = name;
	label.BackgroundTransparency = 1;
	label.Size = size;
	label.Font = Enum.Font.GothamMedium;
	label.TextSize = textSize;
	label.TextXAlignment = Enum.TextXAlignment.Left;
	label.TextColor3 = Color3.fromRGB(220, 225, 235);
	label.Text = "";
	label.LayoutOrder = order;
	label.Parent = parent;
	return label;
}

function makeActionButton(parent: Instance, name: string, text: string, order: number): TextButton {
	const button = new Instance("TextButton");
	button.Name = name;
	button.Size = new UDim2(0, 110, 0, 36);
	button.BackgroundColor3 = BTN_IDLE;
	button.BorderSizePixel = 0;
	button.Font = Enum.Font.GothamBold;
	button.TextSize = 14;
	button.TextColor3 = Color3.fromRGB(235, 235, 240);
	button.Text = text;
	button.AutoButtonColor = true;
	button.LayoutOrder = order;
	button.Parent = parent;

	const corner = new Instance("UICorner");
	corner.CornerRadius = new UDim(0, 6);
	corner.Parent = button;

	return button;
}

function buildHud(): {
	banner: TextLabel;
	stats: TextLabel;
	prompt: TextLabel;
	hint: TextLabel;
	flash: Frame;
	attackBtn: TextButton;
	moveBtn: TextButton;
	confirmBtn: TextButton;
	cancelBtn: TextButton;
	endTurnBtn: TextButton;
} {
	const player = Players.LocalPlayer;
	const gui = new Instance("ScreenGui");
	gui.Name = "CombatHud";
	gui.ResetOnSpawn = false;
	gui.IgnoreGuiInset = true;
	gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling;
	gui.Parent = player.WaitForChild("PlayerGui");

	const flash = new Instance("Frame");
	flash.Name = "EvadeFlash";
	flash.Size = new UDim2(1, 0, 1, 0);
	flash.BackgroundColor3 = IDLE;
	flash.BackgroundTransparency = 1;
	flash.BorderSizePixel = 0;
	flash.ZIndex = 1;
	flash.Parent = gui;

	const banner = new Instance("TextLabel");
	banner.Name = "TurnBanner";
	banner.AnchorPoint = new Vector2(0.5, 0);
	banner.Position = new UDim2(0.5, 0, 0, 18);
	banner.Size = new UDim2(0, 520, 0, 40);
	banner.BackgroundColor3 = Color3.fromRGB(12, 14, 18);
	banner.BackgroundTransparency = 0.2;
	banner.BorderSizePixel = 0;
	banner.Font = Enum.Font.GothamBold;
	banner.TextSize = 22;
	banner.TextColor3 = Color3.fromRGB(245, 245, 250);
	banner.Text = "Waiting for encounter…";
	banner.ZIndex = 3;
	banner.Parent = gui;

	const bannerCorner = new Instance("UICorner");
	bannerCorner.CornerRadius = new UDim(0, 8);
	bannerCorner.Parent = banner;

	const panel = new Instance("Frame");
	panel.Name = "Panel";
	panel.AnchorPoint = new Vector2(0, 1);
	panel.Position = new UDim2(0, 16, 1, -16);
	panel.Size = new UDim2(0, 560, 0, 168);
	panel.BackgroundColor3 = Color3.fromRGB(12, 14, 18);
	panel.BackgroundTransparency = 0.2;
	panel.BorderSizePixel = 0;
	panel.ZIndex = 2;
	panel.Parent = gui;

	const panelCorner = new Instance("UICorner");
	panelCorner.CornerRadius = new UDim(0, 8);
	panelCorner.Parent = panel;

	const padding = new Instance("UIPadding");
	padding.PaddingTop = new UDim(0, 10);
	padding.PaddingBottom = new UDim(0, 10);
	padding.PaddingLeft = new UDim(0, 12);
	padding.PaddingRight = new UDim(0, 12);
	padding.Parent = panel;

	const layout = new Instance("UIListLayout");
	layout.FillDirection = Enum.FillDirection.Vertical;
	layout.Padding = new UDim(0, 6);
	layout.SortOrder = Enum.SortOrder.LayoutOrder;
	layout.Parent = panel;

	const stats = makeLabel(panel, "Stats", new UDim2(1, 0, 0, 24), 1, 18);
	stats.Font = Enum.Font.GothamBold;
	stats.Text = "HP —/—  ·  MP —  ·  Stamina —/—";

	const prompt = makeLabel(panel, "Prompt", new UDim2(1, 0, 0, 22), 2, 15);
	prompt.Text = "Select an action";

	const hint = makeLabel(panel, "Hint", new UDim2(1, 0, 0, 20), 3, 13);
	hint.TextColor3 = Color3.fromRGB(160, 170, 190);
	hint.Text = HINT_IDLE;

	const actions = new Instance("Frame");
	actions.Name = "Actions";
	actions.BackgroundTransparency = 1;
	actions.Size = new UDim2(1, 0, 0, 40);
	actions.LayoutOrder = 4;
	actions.Parent = panel;

	const actionsLayout = new Instance("UIListLayout");
	actionsLayout.FillDirection = Enum.FillDirection.Horizontal;
	actionsLayout.Padding = new UDim(0, 8);
	actionsLayout.SortOrder = Enum.SortOrder.LayoutOrder;
	actionsLayout.Parent = actions;

	const attackBtn = makeActionButton(actions, "Attack", "Attack", 1);
	const moveBtn = makeActionButton(actions, "Move", "Move", 2);
	const confirmBtn = makeActionButton(actions, "Confirm", "Confirm", 3);
	const cancelBtn = makeActionButton(actions, "Cancel", "Cancel", 4);
	const endTurnBtn = makeActionButton(actions, "EndTurn", "End Turn", 5);

	return {
		banner,
		stats,
		prompt,
		hint,
		flash,
		attackBtn,
		moveBtn,
		confirmBtn,
		cancelBtn,
		endTurnBtn,
	};
}

function setButtonEnabled(button: TextButton, enabled: boolean, active = false): void {
	button.Active = enabled;
	button.AutoButtonColor = enabled;
	button.BackgroundColor3 = !enabled ? BTN_DISABLED : active ? BTN_ACTIVE : BTN_IDLE;
	button.TextTransparency = enabled ? 0 : 0.45;
}

/** Combat HUD: turn banner and ability bar. Targeting lives on the 3D battlefield. */
export function startCombatHud(): void {
	const { banner, stats, prompt, hint, flash, attackBtn, moveBtn, confirmBtn, cancelBtn, endTurnBtn } = buildHud();

	const paint = () => {
		const snapshot = encounterAtom();
		const intent = combatIntentAtom();
		const player = localPlayerSnap(snapshot);
		const canAct = snapshot?.phase === "awaitingAction" && snapshot.actor === "player";
		const mainReady = player?.mainActionAvailable === true;

		banner.Text = turnBanner(snapshot);
		banner.TextColor3 =
			snapshot?.actor === "player" && canAct
				? Color3.fromRGB(120, 210, 255)
				: snapshot?.phase === "resolvingEvade" || snapshot?.actor === "enemy"
					? Color3.fromRGB(255, 140, 120)
					: Color3.fromRGB(245, 245, 250);

		if (player !== undefined) {
			stats.Text = `HP ${player.health.current}/${player.health.max}  ·  MP ${math.floor(player.movementPoints)}  ·  Stamina ${player.stamina.current}/${player.stamina.max}${mainReady ? "  ·  Main ready" : "  ·  Main used"}`;
		} else {
			const fallback = combatantAtom();
			stats.Text =
				fallback !== undefined
					? `HP ${fallback.health.current}/${fallback.health.max}  ·  MP ${fallback.movementPoints}  ·  Stamina ${fallback.stamina.current}/${fallback.stamina.max}`
					: "HP —/—  ·  MP —  ·  Stamina —/—";
		}

		if (!canAct) {
			prompt.Text =
				snapshot?.phase === "resolvingEvade"
					? "Evade with Q (parry) / E (dodge)"
					: snapshot?.phase === "complete"
						? "Encounter over"
						: "Wait for your turn…";
		} else if (intent.mode === "attack") {
			prompt.Text =
				intent.targetGuid !== undefined
					? "Attack ready — click the enemy or press Confirm"
					: "Click the enemy to attack";
		} else if (intent.mode === "move") {
			prompt.Text = "Click the ground — movement spends MP along the path";
		} else {
			prompt.Text = "Choose Attack or Move, then End Turn when finished";
		}

		setButtonEnabled(attackBtn, canAct && mainReady, intent.mode === "attack");
		setButtonEnabled(moveBtn, canAct && (player?.movementPoints ?? 0) > 0, intent.mode === "move");
		setButtonEnabled(confirmBtn, canAct && intent.mode === "attack" && intent.targetGuid !== undefined);
		setButtonEnabled(cancelBtn, canAct && intent.mode !== "none");
		setButtonEnabled(endTurnBtn, canAct);
	};

	attackBtn.MouseButton1Click.Connect(() => {
		if (attackBtn.Active) selectAttackAbility("basicAttack");
	});
	moveBtn.MouseButton1Click.Connect(() => {
		if (moveBtn.Active) selectMoveMode();
	});
	confirmBtn.MouseButton1Click.Connect(() => {
		if (confirmBtn.Active) confirmCombatIntent();
	});
	cancelBtn.MouseButton1Click.Connect(() => {
		cancelCombatIntent();
	});
	endTurnBtn.MouseButton1Click.Connect(() => {
		if (endTurnBtn.Active) endPlayerTurn();
	});

	subscribe(combatantAtom, paint);
	subscribe(encounterAtom, (snapshot) => {
		if (snapshot === undefined || snapshot.phase !== "awaitingAction" || snapshot.actor !== "player") {
			clearCombatIntent();
		}
		paint();
	});
	subscribe(combatIntentAtom, paint);

	subscribe(evadeWindowAtom, (window) => {
		if (window === undefined) {
			flash.BackgroundTransparency = 1;
			hint.Text = HINT_IDLE;
			paint();
			return;
		}

		if (window.resolved) {
			flash.BackgroundColor3 = window.success === true ? SUCCESS : MISS;
			flash.BackgroundTransparency = 0.55;
			const label = window.reaction.upper();
			prompt.Text = window.success === true ? `${label} — hit!` : `${label} — missed`;
			return;
		}

		const isOpen = window.opened;
		flash.BackgroundColor3 = isOpen
			? window.reaction === "parry"
				? OPEN_PARRY
				: OPEN_DODGE
			: TELEGRAPH;
		flash.BackgroundTransparency = isOpen ? 0.45 : 0.7;
		const label = window.reaction.upper();
		prompt.Text = isOpen ? `${label} NOW — Q parry · E dodge` : `${label} incoming…`;
	});

	paint();
}
