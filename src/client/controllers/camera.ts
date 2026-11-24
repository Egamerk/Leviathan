import { subscribe } from "@rbxts/charm";
import { RunService, UserInputService, Workspace } from "@rbxts/services";
import { combatants, gameMode, turn } from "client/store";

/**
 * Explore: Roblox's default free camera (Trello: "free to move your camera").
 * Combat: a tactical orbit camera (BG3-style) that glides to whoever is acting.
 *   ← / →  rotate      mouse wheel  zoom
 */

const camera = Workspace.CurrentCamera!;
let yaw = math.rad(45);
let zoom = 38;
let focus = Vector3.zero;
let connection: RBXScriptConnection | undefined;

const PITCH = math.rad(55);
const MIN_ZOOM = 18;
const MAX_ZOOM = 70;

function actorFocus(): Vector3 | undefined {
	const actorId = turn()?.actorId;
	const model = actorId !== undefined ? combatants().get(actorId)?.model : undefined;
	return model?.GetPivot().Position;
}

function enterCombat() {
	camera.CameraType = Enum.CameraType.Scriptable;
	focus = actorFocus() ?? camera.Focus.Position;
	connection?.Disconnect();
	connection = RunService.RenderStepped.Connect((dt) => {
		if (UserInputService.IsKeyDown(Enum.KeyCode.Left)) yaw += dt * 1.8;
		if (UserInputService.IsKeyDown(Enum.KeyCode.Right)) yaw -= dt * 1.8;

		const target = actorFocus();
		if (target) focus = focus.Lerp(target, math.min(dt * 4, 1));

		const offset = new Vector3(
			math.cos(yaw) * math.cos(PITCH),
			math.sin(PITCH),
			math.sin(yaw) * math.cos(PITCH),
		).mul(zoom);
		camera.CFrame = camera.CFrame.Lerp(CFrame.lookAt(focus.add(offset), focus), math.min(dt * 8, 1));
	});
}

function exitCombat() {
	connection?.Disconnect();
	connection = undefined;
	camera.CameraType = Enum.CameraType.Custom;
}

export function startCameraController() {
	UserInputService.InputChanged.Connect((input) => {
		if (gameMode() !== "Combat" || input.UserInputType !== Enum.UserInputType.MouseWheel) return;
		zoom = math.clamp(zoom - input.Position.Z * 4, MIN_ZOOM, MAX_ZOOM);
	});
	subscribe(gameMode, (mode) => (mode === "Combat" ? enterCombat() : exitCombat()));
}
