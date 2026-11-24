import { subscribe } from "@rbxts/charm";
import { Players, RunService, UserInputService, Workspace } from "@rbxts/services";
import { gameMode } from "client/store";
import { MovementConfig as M } from "shared/config";
import { ClientNet } from "shared/net/client";

/**
 * Out-of-combat movement kit (Trello: Main Systems → Movement).
 *
 *  Double-tap W ........ sprint (until W released)
 *  Q (grounded) ........ directional dash from WASD, backwards if idle      CD 1.5s
 *  Space near wall ..... wall climb (airborne, facing wall, once per air)    CD 0
 *  Space, back to wall . wall bounce (spring up + forward)                   CD 3s after landing
 *  Hold Space + Q air .. swim dash toward camera look (max 2 charges)        CD 1.5s
 *  Ctrl (airborne) ..... rapid descend                                       CD 2s
 *  Ctrl (grounded) ..... toggle crouch (slower, smaller detection range)    CD 0.15s
 *
 * Plus the "underwater" terminal-velocity cap. Runs locally for responsiveness;
 * the server only needs stance (crouch/sprint) for detection.
 */

const player = Players.LocalPlayer;

interface Rig {
	character: Model;
	humanoid: Humanoid;
	root: BasePart;
}

let rig: Rig | undefined;
let enabled = true;

// State
let sprinting = false;
let crouching = false;
let lastWTap = 0;
let wasGrounded = true;
let descending = false;
let climbedThisAir = false;
let bouncedThisAir = false;
let swimCharges = 1;
let dashUntil = 0;
let dashVelocity = Vector3.zero;

// Cooldowns (os.clock timestamps)
let dashReadyAt = 0;
let swimReadyAt = 0;
let bounceReadyAt = 0;
let descendReadyAt = 0;
let crouchReadyAt = 0;

const wallParams = new RaycastParams();
wallParams.FilterType = Enum.RaycastFilterType.Exclude;

function sendStance() {
	ClientNet.setStance.fire({ crouching, sprinting });
}

function applySpeed() {
	if (rig === undefined) return;
	rig.humanoid.WalkSpeed = crouching ? M.crouchSpeed : sprinting ? M.sprintSpeed : M.walkSpeed;
}

function grounded(): boolean {
	return rig !== undefined && rig.humanoid.FloorMaterial !== Enum.Material.Air;
}

function wallIn(direction: Vector3): RaycastResult | undefined {
	if (rig === undefined) return undefined;
	wallParams.FilterDescendantsInstances = [rig.character];
	const hit = Workspace.Raycast(rig.root.Position, direction.mul(M.wallCheckDistance), wallParams);
	// Only near-vertical surfaces count as walls.
	return hit !== undefined && math.abs(hit.Normal.Y) < 0.4 ? hit : undefined;
}

function setVelocity(velocity: Vector3) {
	if (rig) rig.root.AssemblyLinearVelocity = velocity;
}

function grantSwimCharge() {
	swimCharges = math.min(swimCharges + 1, M.swimDashMaxCharges);
}

/** WASD relative to the camera, flattened. Zero when no key is held. */
function inputDirection(): Vector3 {
	const camera = Workspace.CurrentCamera!;
	const look = new Vector3(camera.CFrame.LookVector.X, 0, camera.CFrame.LookVector.Z).Unit;
	const right = new Vector3(camera.CFrame.RightVector.X, 0, camera.CFrame.RightVector.Z).Unit;
	let direction = Vector3.zero;
	if (UserInputService.IsKeyDown(Enum.KeyCode.W)) direction = direction.add(look);
	if (UserInputService.IsKeyDown(Enum.KeyCode.S)) direction = direction.sub(look);
	if (UserInputService.IsKeyDown(Enum.KeyCode.D)) direction = direction.add(right);
	if (UserInputService.IsKeyDown(Enum.KeyCode.A)) direction = direction.sub(right);
	return direction.Magnitude > 0 ? direction.Unit : Vector3.zero;
}

// ── Actions ─────────────────────────────────────────────────────────────────

function onSpace() {
	if (rig === undefined || grounded()) return;
	const look = rig.root.CFrame.LookVector;
	const now = os.clock();

	if (!climbedThisAir && wallIn(look) !== undefined) {
		climbedThisAir = true;
		grantSwimCharge();
		const v = rig.root.AssemblyLinearVelocity;
		setVelocity(new Vector3(v.X * 0.3, M.wallClimbVelocity, v.Z * 0.3));
		return;
	}

	if (!bouncedThisAir && now >= bounceReadyAt && wallIn(look.mul(-1)) !== undefined) {
		bouncedThisAir = true;
		grantSwimCharge();
		setVelocity(look.mul(M.wallBounceOutVelocity).add(new Vector3(0, M.wallBounceUpVelocity, 0)));
	}
}

function onQ() {
	if (rig === undefined) return;
	const now = os.clock();

	if (!grounded()) {
		if (!UserInputService.IsKeyDown(Enum.KeyCode.Space)) return;
		if (swimCharges <= 0 || now < swimReadyAt) return;
		swimCharges -= 1;
		swimReadyAt = now + M.swimDashCooldown;
		setVelocity(Workspace.CurrentCamera!.CFrame.LookVector.mul(M.swimDashSpeed));
		return;
	}

	if (now < dashReadyAt) return;
	dashReadyAt = now + M.dashCooldown;
	let direction = inputDirection();
	if (direction === Vector3.zero) {
		const look = rig.root.CFrame.LookVector;
		direction = new Vector3(-look.X, 0, -look.Z).Unit; // Trello: idle dash goes backwards
	}
	dashVelocity = direction.mul(M.dashSpeed);
	dashUntil = now + M.dashDuration;
}

function onCtrl() {
	if (rig === undefined) return;
	const now = os.clock();
	if (!grounded()) {
		if (now < descendReadyAt) return;
		descendReadyAt = now + M.descendCooldown;
		descending = true;
		const v = rig.root.AssemblyLinearVelocity;
		setVelocity(new Vector3(v.X, -M.descendVelocity, v.Z));
		return;
	}
	if (now < crouchReadyAt) return;
	crouchReadyAt = now + M.crouchCooldown;
	crouching = !crouching;
	if (crouching) sprinting = false;
	rig.humanoid.CameraOffset = crouching ? new Vector3(0, -1.5, 0) : Vector3.zero;
	applySpeed();
	sendStance();
}

function onW() {
	const now = os.clock();
	if (now - lastWTap <= M.doubleTapWindow && !crouching) {
		sprinting = true;
		applySpeed();
		sendStance();
	}
	lastWTap = now;
}

// ── Per-frame ───────────────────────────────────────────────────────────────

function step() {
	if (rig === undefined || !enabled) return;
	const now = os.clock();
	const isGrounded = grounded();

	if (isGrounded && !wasGrounded) {
		// Landing resets air abilities; bounce cooldown starts on touchdown (Trello).
		if (bouncedThisAir) bounceReadyAt = now + M.wallBounceCooldown;
		climbedThisAir = false;
		bouncedThisAir = false;
		descending = false;
		swimCharges = math.max(swimCharges, 1);
	}
	wasGrounded = isGrounded;

	const velocity = rig.root.AssemblyLinearVelocity;
	if (now < dashUntil) {
		setVelocity(new Vector3(dashVelocity.X, velocity.Y, dashVelocity.Z));
	} else if (!descending && velocity.Y < -M.terminalVelocity) {
		setVelocity(new Vector3(velocity.X, -M.terminalVelocity, velocity.Z));
	}
}

// ── Wiring ──────────────────────────────────────────────────────────────────

function bindCharacter(character: Model) {
	const humanoid = character.WaitForChild("Humanoid") as Humanoid;
	const root = character.WaitForChild("HumanoidRootPart") as BasePart;
	rig = { character, humanoid, root };
	sprinting = false;
	crouching = false;
	applySpeed();
	sendStance();
}

/** PlayerModule controls, so combat can freeze WASD without fighting the default scripts. */
function setControlsEnabled(on: boolean) {
	const playerModule = player.WaitForChild("PlayerScripts").WaitForChild("PlayerModule") as ModuleScript;
	// eslint-disable-next-line @typescript-eslint/no-require-imports -- Roblox's PlayerModule
	const module = require(playerModule) as {
		GetControls(this: unknown): { Enable(this: unknown): void; Disable(this: unknown): void };
	};
	const controls = module.GetControls();
	if (on) controls.Enable();
	else controls.Disable();
}

export function startMovementController() {
	if (player.Character) task.spawn(bindCharacter, player.Character);
	player.CharacterAdded.Connect(bindCharacter);

	UserInputService.InputBegan.Connect((input, processed) => {
		if (processed || !enabled) return;
		switch (input.KeyCode) {
			case Enum.KeyCode.Space:
				onSpace();
				break;
			case Enum.KeyCode.Q:
				onQ();
				break;
			case Enum.KeyCode.LeftControl:
				onCtrl();
				break;
			case Enum.KeyCode.W:
				onW();
				break;
		}
	});
	UserInputService.InputEnded.Connect((input) => {
		if (input.KeyCode === Enum.KeyCode.W && sprinting) {
			sprinting = false;
			applySpeed();
			sendStance();
		}
	});
	RunService.Heartbeat.Connect(step);

	// Combat takes over the character: freeze the kit and default controls.
	subscribe(gameMode, (mode) => {
		enabled = mode === "Explore";
		sprinting = false;
		applySpeed();
		task.spawn(setControlsEnabled, enabled);
	});
}
