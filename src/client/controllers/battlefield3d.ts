import { subscribe } from "@rbxts/charm";
import {
	ContextActionService,
	Players,
	RunService,
	UserInputService,
	Workspace,
} from "@rbxts/services";
import { ABILITY_DEFINITIONS } from "shared/data/abilities";
import {
	fromWorldPoint,
	horizontalDistance,
	isOccupied,
	OCCUPY_RADIUS,
	trimPathToBudget,
} from "shared/data/combatNav";
import { computeWorldPath } from "shared/data/worldPath";
import type { EncounterCombatantSnapshot, EncounterSnapshot } from "shared/net/types";
import { confirmCombatIntent } from "client/controllers/combat";
import {
	findCombatantModel,
	isLocomotionBusy,
	setActiveEncounter,
	startCombatActors,
} from "client/controllers/combatActors";
import {
	combatIntentAtom,
	setAttackTarget,
	setMoveDestination,
} from "shared/state/combatIntent";
import { encounterAtom } from "shared/state/encounter";

const OVERLAY_NAME = "CombatOverlay";
const MOVEMENT_LOCK_ACTION = "CombatMovementLock";

const PATH_VALID = Color3.fromRGB(55, 140, 230);
const PATH_INVALID = Color3.fromRGB(210, 70, 70);
const MARKER_VALID = Color3.fromRGB(70, 170, 255);
const MARKER_INVALID = Color3.fromRGB(220, 80, 80);
const ATTACK_IN_RANGE = Color3.fromRGB(220, 120, 50);
const ATTACK_OUT_RANGE = Color3.fromRGB(90, 90, 96);

const DEFAULT_WALK_SPEED = 16;
const DEFAULT_JUMP_POWER = 50;
const DEFAULT_JUMP_HEIGHT = 7.2;

const CAMERA_MIN_DISTANCE = 12;
const CAMERA_MAX_DISTANCE = 80;
const CAMERA_MIN_PITCH = math.rad(12);
const CAMERA_MAX_PITCH = math.rad(80);
const CAMERA_DEFAULT_YAW = math.rad(45);
const CAMERA_DEFAULT_PITCH = math.rad(48);
const CAMERA_DEFAULT_DISTANCE = 36;
const CAMERA_ORBIT_SENS = 0.006;
const CAMERA_PAN_SENS = 0.04;
const CAMERA_FOLLOW_RATE = 8;

interface CameraMemory {
	cameraType: Enum.CameraType;
	cframe: CFrame;
	subject: Humanoid | BasePart | undefined;
}

interface PlayerControls {
	Disable: (this: PlayerControls) => void;
	Enable: (this: PlayerControls) => void;
}

interface PlayerModuleInstance {
	GetControls: (this: PlayerModuleInstance) => PlayerControls;
}

interface CombatCamera {
	yaw: number;
	pitch: number;
	distance: number;
	focus: Vector3;
}

let overlay: Folder | undefined;
let destinationMarker: Part | undefined;
let pathFolder: Folder | undefined;
let attackHighlight: Highlight | undefined;
let cameraMemory: CameraMemory | undefined;
let combatCamera: CombatCamera | undefined;
let combatLocked = false;
let movementLockBound = false;
let characterAddedConnection: RBXScriptConnection | undefined;
let playerControls: PlayerControls | undefined;
let hoveredGround: Vector3 | undefined;
let previewPath: Vector3[] | undefined;
let previewCost = 0;
let previewToken = 0;
let panningThisFrame = false;

function localPlayerSnap(snapshot: EncounterSnapshot): EncounterCombatantSnapshot | undefined {
	return snapshot.combatants.find((combatant) => combatant.kind === "player");
}

function enemySnap(snapshot: EncounterSnapshot): EncounterCombatantSnapshot | undefined {
	return snapshot.combatants.find((combatant) => combatant.kind === "enemy");
}

function isActiveEncounter(snapshot: EncounterSnapshot | undefined): snapshot is EncounterSnapshot {
	return snapshot !== undefined && snapshot.phase !== "complete";
}

function occupantPositions(snapshot: EncounterSnapshot, ignoreGuid?: string): Vector3[] {
	const positions: Vector3[] = [];
	for (const combatant of snapshot.combatants) {
		if (combatant.guid === ignoreGuid) continue;
		positions.push(fromWorldPoint(combatant));
	}
	return positions;
}

function overlayFolder(): Folder {
	if (overlay !== undefined) return overlay;
	const folder = new Instance("Folder");
	folder.Name = OVERLAY_NAME;
	folder.Parent = Workspace;
	overlay = folder;
	return folder;
}

function makeOverlayPart(name: string, size: Vector3, color: Color3, parent: Instance): Part {
	const part = new Instance("Part");
	part.Name = name;
	part.Size = size;
	part.Color = color;
	part.Material = Enum.Material.Neon;
	part.Anchored = true;
	part.CanCollide = false;
	part.CanTouch = false;
	part.CanQuery = false;
	part.CastShadow = false;
	part.Parent = parent;
	return part;
}

function clearPathPreview(): void {
	pathFolder?.Destroy();
	pathFolder = undefined;
	if (destinationMarker !== undefined) {
		destinationMarker.Destroy();
		destinationMarker = undefined;
	}
}

function destroyOverlay(): void {
	clearPathPreview();
	attackHighlight?.Destroy();
	attackHighlight = undefined;
	overlay?.Destroy();
	overlay = undefined;
	hoveredGround = undefined;
	previewPath = undefined;
	previewCost = 0;
	previewToken += 1;
}

function drawPath(points: readonly Vector3[], valid: boolean): void {
	if (pathFolder === undefined) {
		const folder = new Instance("Folder");
		folder.Name = "Path";
		folder.Parent = overlayFolder();
		pathFolder = folder;
	}

	const existing = pathFolder.GetChildren();
	const needed = math.max(0, points.size() - 1);
	const color = valid ? PATH_VALID : PATH_INVALID;

	for (let index = 0; index < needed; index += 1) {
		const from = points[index];
		const to = points[index + 1];
		if (from === undefined || to === undefined) continue;
		const start = new Vector3(from.X, from.Y + 0.16, from.Z);
		const finish = new Vector3(to.X, to.Y + 0.16, to.Z);
		const delta = finish.sub(start);
		const length = math.max(delta.Magnitude, 0.05);
		const child = existing[index];
		let segment: Part;
		if (child?.IsA("Part") === true) {
			segment = child;
		} else {
			child?.Destroy();
			segment = makeOverlayPart(`Seg_${index}`, new Vector3(0.22, 0.08, length), color, pathFolder);
		}
		segment.Size = new Vector3(0.22, 0.08, length);
		segment.Color = color;
		segment.CFrame = CFrame.lookAt(start.Lerp(finish, 0.5), finish);
	}

	for (let index = needed; index < existing.size(); index += 1) {
		existing[index]?.Destroy();
	}
}

function drawDestination(position: Vector3, valid: boolean): void {
	if (destinationMarker === undefined) {
		const marker = makeOverlayPart(
			"Destination",
			new Vector3(1.6, 0.18, 1.6),
			valid ? MARKER_VALID : MARKER_INVALID,
			overlayFolder(),
		);
		marker.Shape = Enum.PartType.Cylinder;
		destinationMarker = marker;
	}
	destinationMarker.Color = valid ? MARKER_VALID : MARKER_INVALID;
	destinationMarker.CFrame = new CFrame(position.add(new Vector3(0, 0.12, 0))).mul(CFrame.Angles(0, 0, math.rad(90)));
}

function setAttackHighlight(model: Model | undefined, inRange: boolean): void {
	if (model === undefined) {
		attackHighlight?.Destroy();
		attackHighlight = undefined;
		return;
	}
	if (attackHighlight === undefined) {
		const highlight = new Instance("Highlight");
		highlight.Name = "AttackHighlight";
		highlight.FillTransparency = 0.65;
		highlight.OutlineTransparency = 0;
		highlight.Parent = overlayFolder();
		attackHighlight = highlight;
	}
	attackHighlight.Adornee = model;
	attackHighlight.FillColor = inRange ? ATTACK_IN_RANGE : ATTACK_OUT_RANGE;
	attackHighlight.OutlineColor = inRange ? ATTACK_IN_RANGE : ATTACK_OUT_RANGE;
}

function playerGround(snapshot: EncounterSnapshot): Vector3 | undefined {
	const player = localPlayerSnap(snapshot);
	if (player === undefined) return undefined;
	const model = findCombatantModel(player.guid);
	const root = model?.FindFirstChild("HumanoidRootPart");
	if (root?.IsA("BasePart") === true && !isLocomotionBusy()) {
		return new Vector3(root.Position.X, player.y, root.Position.Z);
	}
	return fromWorldPoint(player);
}

function followFocus(): Vector3 | undefined {
	const snapshot = encounterAtom();
	if (!isActiveEncounter(snapshot)) return undefined;

	const actor =
		snapshot.actor === "enemy"
			? enemySnap(snapshot)
			: localPlayerSnap(snapshot) ?? snapshot.combatants[0];
	if (actor === undefined) return undefined;

	const model = findCombatantModel(actor.guid);
	const root = model?.FindFirstChild("HumanoidRootPart");
	if (root?.IsA("BasePart") === true) return root.Position;
	return fromWorldPoint(actor);
}

function rememberCamera(): void {
	const camera = Workspace.CurrentCamera;
	if (camera === undefined || cameraMemory !== undefined) return;
	const subject = camera.CameraSubject;
	cameraMemory = {
		cameraType: camera.CameraType,
		cframe: camera.CFrame,
		subject: subject?.IsA("Humanoid") === true || subject?.IsA("BasePart") === true ? subject : undefined,
	};
}

function restoreCamera(): void {
	const camera = Workspace.CurrentCamera;
	const memory = cameraMemory;
	cameraMemory = undefined;
	combatCamera = undefined;
	UserInputService.MouseBehavior = Enum.MouseBehavior.Default;
	if (camera === undefined || memory === undefined) return;
	camera.CameraType = memory.cameraType;
	camera.CameraSubject = memory.subject;
	if (memory.cameraType === Enum.CameraType.Scriptable) {
		camera.CFrame = memory.cframe;
	}
}

function startCombatCamera(): void {
	rememberCamera();
	const focus = followFocus() ?? new Vector3(0, 3, 0);
	combatCamera = {
		yaw: CAMERA_DEFAULT_YAW,
		pitch: CAMERA_DEFAULT_PITCH,
		distance: CAMERA_DEFAULT_DISTANCE,
		focus,
	};
}

function flattenedCameraAxes(camera: Camera, yaw: number): { forward: Vector3; right: Vector3 } {
	let forward = new Vector3(camera.CFrame.LookVector.X, 0, camera.CFrame.LookVector.Z);
	let right = new Vector3(camera.CFrame.RightVector.X, 0, camera.CFrame.RightVector.Z);
	if (forward.Magnitude < 0.15) {
		forward = new Vector3(math.sin(yaw), 0, math.cos(yaw));
	}
	if (right.Magnitude < 0.15) {
		right = new Vector3(math.cos(yaw), 0, -math.sin(yaw));
	}
	return { forward: forward.Unit, right: right.Unit };
}

function updateCombatCamera(dt: number): void {
	const camera = Workspace.CurrentCamera;
	const state = combatCamera;
	if (camera === undefined || state === undefined) return;

	const orbiting = UserInputService.IsMouseButtonPressed(Enum.UserInputType.MouseButton2);
	const mmb = UserInputService.IsMouseButtonPressed(Enum.UserInputType.MouseButton3);
	UserInputService.MouseBehavior =
		orbiting || mmb ? Enum.MouseBehavior.LockCurrentPosition : Enum.MouseBehavior.Default;
	const delta = UserInputService.GetMouseDelta();
	panningThisFrame = false;

	if (orbiting) {
		state.yaw -= delta.X * CAMERA_ORBIT_SENS;
		state.pitch = math.clamp(state.pitch + delta.Y * CAMERA_ORBIT_SENS, CAMERA_MIN_PITCH, CAMERA_MAX_PITCH);
	}

	const axes = flattenedCameraAxes(camera, state.yaw);
	const forward = axes.forward;
	const right = axes.right;
	let pan = new Vector3();
	if (mmb) {
		pan = pan.add(right.mul(-delta.X * CAMERA_PAN_SENS * (state.distance / 24)));
		pan = pan.add(forward.mul(delta.Y * CAMERA_PAN_SENS * (state.distance / 24)));
		panningThisFrame = true;
	}

	const panSpeed = state.distance * 0.9;
	if (UserInputService.IsKeyDown(Enum.KeyCode.W)) pan = pan.add(forward.mul(panSpeed * dt));
	if (UserInputService.IsKeyDown(Enum.KeyCode.S)) pan = pan.add(forward.mul(-panSpeed * dt));
	if (UserInputService.IsKeyDown(Enum.KeyCode.A)) pan = pan.add(right.mul(-panSpeed * dt));
	if (UserInputService.IsKeyDown(Enum.KeyCode.D)) pan = pan.add(right.mul(panSpeed * dt));
	if (pan.Magnitude > 0) {
		state.focus = state.focus.add(pan);
		panningThisFrame = true;
	}

	if (!panningThisFrame) {
		const target = followFocus();
		if (target !== undefined && (isLocomotionBusy() || combatLocked)) {
			const alpha = 1 - math.exp(-CAMERA_FOLLOW_RATE * dt);
			state.focus = state.focus.Lerp(target, alpha);
		}
	}

	const offset = new Vector3(
		math.sin(state.yaw) * math.cos(state.pitch) * state.distance,
		math.sin(state.pitch) * state.distance,
		math.cos(state.yaw) * math.cos(state.pitch) * state.distance,
	);
	camera.CameraType = Enum.CameraType.Scriptable;
	camera.CFrame = CFrame.lookAt(state.focus.add(offset), state.focus);
}

function getPlayerControls(): PlayerControls | undefined {
	if (playerControls !== undefined) return playerControls;
	const playerScripts = Players.LocalPlayer.FindFirstChild("PlayerScripts");
	const moduleScript = playerScripts?.FindFirstChild("PlayerModule");
	if (moduleScript?.IsA("ModuleScript") !== true) return undefined;

	const [loaded, playerModule] = pcall(() => require(moduleScript) as PlayerModuleInstance);
	if (!loaded || playerModule === undefined) return undefined;

	const [ok, controls] = pcall(() => playerModule.GetControls());
	if (!ok || controls === undefined) return undefined;

	playerControls = controls;
	return playerControls;
}

function applyCombatCharacterState(character: Model, locked: boolean): void {
	const humanoid = character.FindFirstChildOfClass("Humanoid");
	if (humanoid !== undefined) {
		humanoid.WalkSpeed = DEFAULT_WALK_SPEED;
		humanoid.JumpPower = locked ? 0 : DEFAULT_JUMP_POWER;
		humanoid.JumpHeight = locked ? 0 : DEFAULT_JUMP_HEIGHT;
		humanoid.AutoRotate = true;
	}
	const root = character.FindFirstChild("HumanoidRootPart");
	if (root?.IsA("BasePart") === true) {
		root.Anchored = false;
	}
}

function bindMovementLock(): void {
	if (movementLockBound) return;
	ContextActionService.BindActionAtPriority(
		MOVEMENT_LOCK_ACTION,
		() => Enum.ContextActionResult.Sink,
		false,
		Enum.ContextActionPriority.High.Value,
		Enum.KeyCode.W,
		Enum.KeyCode.A,
		Enum.KeyCode.S,
		Enum.KeyCode.D,
		Enum.KeyCode.Space,
		Enum.PlayerActions.CharacterForward,
		Enum.PlayerActions.CharacterBackward,
		Enum.PlayerActions.CharacterLeft,
		Enum.PlayerActions.CharacterRight,
		Enum.PlayerActions.CharacterJump,
	);
	movementLockBound = true;
}

function unbindMovementLock(): void {
	if (!movementLockBound) return;
	ContextActionService.UnbindAction(MOVEMENT_LOCK_ACTION);
	movementLockBound = false;
}

function setCombatLock(locked: boolean): void {
	combatLocked = locked;
	const character = Players.LocalPlayer.Character;
	if (character !== undefined) applyCombatCharacterState(character, locked);

	characterAddedConnection?.Disconnect();
	characterAddedConnection = undefined;
	if (locked) {
		bindMovementLock();
		if (character !== undefined) {
			getPlayerControls()?.Disable();
		}
		characterAddedConnection = Players.LocalPlayer.CharacterAdded.Connect((nextCharacter) => {
			if (!combatLocked) return;
			applyCombatCharacterState(nextCharacter, true);
			getPlayerControls()?.Disable();
		});
	} else {
		getPlayerControls()?.Enable();
		unbindMovementLock();
	}
}

function combatantFromInstance(instance: Instance): Model | undefined {
	let current: Instance | undefined = instance;
	while (current !== undefined) {
		if (current.IsA("Model") && typeIs(current.GetAttribute("CombatantGuid"), "string")) {
			return current;
		}
		current = current.Parent;
	}
	return undefined;
}

function raycastWorld(): RaycastResult | undefined {
	const camera = Workspace.CurrentCamera;
	if (camera === undefined) return undefined;

	const location = UserInputService.GetMouseLocation();
	const ray = camera.ViewportPointToRay(location.X, location.Y);
	const params = new RaycastParams();
	params.FilterType = Enum.RaycastFilterType.Exclude;
	const ignore: Instance[] = [];
	if (overlay !== undefined) ignore.push(overlay);
	const character = Players.LocalPlayer.Character;
	if (character !== undefined) ignore.push(character);
	params.FilterDescendantsInstances = ignore;
	return Workspace.Raycast(ray.Origin, ray.Direction.mul(800), params);
}

function requestPathPreview(from: Vector3, to: Vector3, budget: number): void {
	previewToken += 1;
	const token = previewToken;
	task.delay(0.05, () => {
		if (token !== previewToken) return;
		task.spawn(() => {
			const raw = computeWorldPath(from, to);
			if (token !== previewToken) return;
			if (raw === undefined) {
				previewPath = [from, to];
				previewCost = horizontalDistance(from, to);
			} else {
				const trimmed = trimPathToBudget(raw, budget);
				previewPath = trimmed.path.size() >= 2 ? trimmed.path : raw;
				previewCost = trimmed.cost > 0 ? trimmed.cost : horizontalDistance(from, to);
			}
			paintField();
		});
	});
}

function paintField(): void {
	const snapshot = encounterAtom();
	const intent = combatIntentAtom();
	if (!isActiveEncounter(snapshot)) {
		clearPathPreview();
		setAttackHighlight(undefined, false);
		return;
	}

	const player = localPlayerSnap(snapshot);
	const enemy = enemySnap(snapshot);
	const canAct = snapshot.phase === "awaitingAction" && snapshot.actor === "player";

	if (!canAct || intent.mode !== "move" || player === undefined || hoveredGround === undefined || isLocomotionBusy()) {
		clearPathPreview();
	} else {
		const occupants = occupantPositions(snapshot, player.guid);
		const occupied = isOccupied(hoveredGround, occupants, OCCUPY_RADIUS);
		const valid = !occupied && previewCost > 0.05 && previewCost <= player.movementPoints;
		if (previewPath !== undefined && previewPath.size() >= 2) {
			drawPath(previewPath, valid);
		} else {
			drawPath([fromWorldPoint(player), hoveredGround], valid);
		}
		drawDestination(hoveredGround, valid);
	}

	if (canAct && intent.mode === "attack" && player !== undefined && enemy !== undefined) {
		const model = findCombatantModel(enemy.guid);
		const inRange = horizontalDistance(fromWorldPoint(player), fromWorldPoint(enemy)) <= ABILITY_DEFINITIONS.basicAttack.range;
		setAttackHighlight(model, inRange);
	} else {
		setAttackHighlight(undefined, false);
	}
}

function handleWorldClick(): void {
	const snapshot = encounterAtom();
	if (snapshot?.phase !== "awaitingAction" || snapshot.actor !== "player") return;

	const player = localPlayerSnap(snapshot);
	const enemy = enemySnap(snapshot);
	if (player === undefined) return;

	const intent = combatIntentAtom();
	const hit = raycastWorld();
	if (hit === undefined) return;

	if (intent.mode === "attack") {
		const model = combatantFromInstance(hit.Instance);
		const guid = model?.GetAttribute("CombatantGuid");
		if (!typeIs(guid, "string") || enemy === undefined || guid !== enemy.guid) return;
		if (horizontalDistance(fromWorldPoint(player), fromWorldPoint(enemy)) > ABILITY_DEFINITIONS.basicAttack.range) {
			return;
		}
		setAttackTarget(enemy.guid);
		confirmCombatIntent();
		return;
	}

	if (intent.mode !== "move" || isLocomotionBusy()) return;
	if (hit.Normal.Y < 0.45) return;

	const dest = hit.Position;
	const origin = playerGround(snapshot);
	if (origin === undefined) return;
	if (horizontalDistance(origin, dest) <= 0.2) return;

	const occupants = occupantPositions(snapshot, player.guid);
	if (isOccupied(dest, occupants)) return;
	if (horizontalDistance(origin, dest) > player.movementPoints) return;
	if (previewPath !== undefined && previewCost > player.movementPoints) return;

	setMoveDestination(dest);
	confirmCombatIntent();
}

function handleHover(): void {
	const snapshot = encounterAtom();
	const intent = combatIntentAtom();
	if (!isActiveEncounter(snapshot) || intent.mode !== "move") {
		hoveredGround = undefined;
		return;
	}

	const hit = raycastWorld();
	if (hit === undefined || hit.Normal.Y < 0.45) {
		hoveredGround = undefined;
		previewPath = undefined;
		paintField();
		return;
	}

	const dest = hit.Position;
	const previous = hoveredGround;
	if (previous !== undefined && horizontalDistance(previous, dest) < 0.35) return;
	hoveredGround = dest;

	const origin = playerGround(snapshot);
	const player = localPlayerSnap(snapshot);
	if (origin === undefined || player === undefined) return;
	requestPathPreview(origin, dest, player.movementPoints);
	paintField();
}

function syncEncounter(snapshot: EncounterSnapshot | undefined): void {
	if (!isActiveEncounter(snapshot)) {
		setActiveEncounter(undefined);
		destroyOverlay();
		restoreCamera();
		setCombatLock(false);
		return;
	}

	setActiveEncounter(snapshot.encounterId);
	overlayFolder();
	if (combatCamera === undefined) startCombatCamera();
	setCombatLock(true);
	paintField();
}

/** Click-to-move field, path preview, and BG3-style orbit camera. */
export function startBattlefield3d(): void {
	startCombatActors();
	subscribe(encounterAtom, syncEncounter);
	subscribe(combatIntentAtom, () => paintField());

	UserInputService.InputChanged.Connect((input, gameProcessed) => {
		if (!combatLocked) return;
		if (input.UserInputType === Enum.UserInputType.MouseWheel) {
			const state = combatCamera;
			if (state !== undefined) {
				state.distance = math.clamp(state.distance - input.Position.Z * 4, CAMERA_MIN_DISTANCE, CAMERA_MAX_DISTANCE);
			}
			return;
		}
		if (gameProcessed) return;
		if (
			input.UserInputType !== Enum.UserInputType.MouseMovement &&
			input.UserInputType !== Enum.UserInputType.Touch
		) {
			return;
		}
		handleHover();
	});

	UserInputService.InputBegan.Connect((input, gameProcessed) => {
		if (gameProcessed || !combatLocked) return;
		if (
			input.UserInputType !== Enum.UserInputType.MouseButton1 &&
			input.UserInputType !== Enum.UserInputType.Touch
		) {
			return;
		}
		handleWorldClick();
	});

	RunService.RenderStepped.Connect((dt) => {
		if (!combatLocked || cameraMemory === undefined) return;
		updateCombatCamera(dt);
		if (isLocomotionBusy()) paintField();
	});

	syncEncounter(encounterAtom());
}
