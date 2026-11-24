import { UserInputService } from "@rbxts/services";
import { qte, type QteView } from "client/store";
import type { Limb } from "shared/data/abilities";
import { ClientNet } from "shared/net/client";
import { now } from "shared/util/clock";

/**
 * Quick Time Events (Trello: Quick Time Events / QTE Types).
 *
 * The server opens a window with shared-clock timestamps; we capture the first
 * valid input with `GetServerTimeNow()` and send it. The server judges timing.
 *
 *  Attack window   W/A/S/D picks the limb (Basic Attack), Right Click = torso (Target Hit)
 *  Defense window  F = parry,  Q then A/S/D = dodge left / lean back / right
 */

const LIMB_KEYS = new Map<Enum.KeyCode, Limb>([
	[Enum.KeyCode.W, "Head"],
	[Enum.KeyCode.A, "LeftArm"],
	[Enum.KeyCode.D, "RightArm"],
	[Enum.KeyCode.S, "Legs"],
]);
const DODGE_KEYS = new Map<Enum.KeyCode, "A" | "S" | "D">([
	[Enum.KeyCode.A, "A"],
	[Enum.KeyCode.S, "S"],
	[Enum.KeyCode.D, "D"],
]);
const DODGE_ARM_TIME = 0.5;

let dodgeArmedUntil = 0;

function send(window: QteView, input: Parameters<typeof ClientNet.qteInput.fire>[0]["input"]) {
	qte({ ...window, sent: true });
	ClientNet.qteInput.fire({ windowId: window.windowId, input, pressedAt: now() });
}

function onInput(input: InputObject) {
	const window = qte();
	if (window === undefined || window.sent) return;

	if (window.kind === "Attack") {
		if (input.UserInputType === Enum.UserInputType.MouseButton2)
			return send(window, { type: "Hit", limb: "Torso" });
		const limb = LIMB_KEYS.get(input.KeyCode);
		if (limb !== undefined) send(window, { type: "Hit", limb });
		return;
	}

	if (input.KeyCode === Enum.KeyCode.F && window.canParry) return send(window, { type: "Parry" });
	if (input.KeyCode === Enum.KeyCode.Q && window.canDodge) {
		dodgeArmedUntil = os.clock() + DODGE_ARM_TIME;
		return;
	}
	const direction = DODGE_KEYS.get(input.KeyCode);
	if (direction !== undefined && os.clock() <= dodgeArmedUntil) send(window, { type: "Dodge", direction });
}

export function startQteController() {
	ClientNet.qteWindow.setCallback((data) => {
		const view: QteView = { ...data, sent: false };
		qte(view);
		// Clear the prompt shortly after the window closes.
		task.delay(math.max(data.closesAt - now(), 0) + 0.4, () => {
			if (qte()?.windowId === view.windowId) qte(undefined);
		});
	});
	UserInputService.InputBegan.Connect((input) => onInput(input));
}
