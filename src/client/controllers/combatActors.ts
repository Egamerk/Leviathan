import { Players, Workspace } from "@rbxts/services";
import { COMBAT_ANIMATIONS } from "shared/data/combatAnims";
import { fromWorldPoint } from "shared/data/combatNav";
import Net from "shared/net/client";
import type { CombatAnim, CombatMove, WorldPoint } from "shared/net/types";
import { assertCombatAnim, assertCombatMove } from "shared/net/validators";

const GUID_ATTRIBUTE = "CombatantGuid";
const ACTORS_FOLDER = "CombatActors";
const MOVE_TIMEOUT = 4;
const MODEL_WAIT = 2;

type PresentationEvent =
	| { kind: "move"; payload: CombatMove }
	| { kind: "anim"; payload: CombatAnim };

const queue: PresentationEvent[] = [];
let presenting = false;
let activeEncounterId: string | undefined;

function hipOffset(model: Model): number {
	const humanoid = model.FindFirstChildOfClass("Humanoid");
	const root = model.FindFirstChild("HumanoidRootPart");
	if (root?.IsA("BasePart") !== true) return 3;
	return (humanoid?.HipHeight ?? 2) + root.Size.Y / 2;
}

export function findCombatantModel(guid: string): Model | undefined {
	const character = Players.LocalPlayer.Character;
	if (character !== undefined && character.GetAttribute(GUID_ATTRIBUTE) === guid) {
		return character;
	}

	const folder = Workspace.FindFirstChild(ACTORS_FOLDER);
	if (folder === undefined) return undefined;
	for (const child of folder.GetChildren()) {
		if (child.IsA("Model") && child.GetAttribute(GUID_ATTRIBUTE) === guid) {
			return child;
		}
	}
	return undefined;
}

function waitForModel(guid: string): Model | undefined {
	const existing = findCombatantModel(guid);
	if (existing !== undefined) return existing;

	const deadline = os.clock() + MODEL_WAIT;
	while (os.clock() < deadline) {
		task.wait();
		const found = findCombatantModel(guid);
		if (found !== undefined) return found;
	}
	return undefined;
}

function snapToWorld(model: Model, ground: Vector3): void {
	const root = model.FindFirstChild("HumanoidRootPart");
	if (root?.IsA("BasePart") !== true) return;
	const position = new Vector3(ground.X, ground.Y + hipOffset(model), ground.Z);
	const look = position.add(new Vector3(root.CFrame.LookVector.X, 0, root.CFrame.LookVector.Z));
	if (look.sub(position).Magnitude < 0.05) {
		model.PivotTo(new CFrame(position));
		return;
	}
	model.PivotTo(CFrame.lookAt(position, look));
}

function faceToward(model: Model, targetGuid?: string): void {
	if (targetGuid === undefined) return;
	const target = findCombatantModel(targetGuid);
	const root = model.FindFirstChild("HumanoidRootPart");
	const other = target?.FindFirstChild("HumanoidRootPart");
	if (root?.IsA("BasePart") !== true || other?.IsA("BasePart") !== true) return;
	const look = new Vector3(other.Position.X, root.Position.Y, other.Position.Z);
	if (look.sub(root.Position).Magnitude < 0.05) return;
	model.PivotTo(CFrame.lookAt(root.Position, look));
}

function walkTo(humanoid: Humanoid, position: Vector3): void {
	let finished = false;
	const connection = humanoid.MoveToFinished.Connect(() => {
		finished = true;
	});
	humanoid.MoveTo(position);
	const started = os.clock();
	while (!finished && os.clock() - started < MOVE_TIMEOUT) {
		task.wait();
	}
	connection.Disconnect();
}

function walkPath(model: Model, path: WorldPoint[]): void {
	const humanoid = model.FindFirstChildOfClass("Humanoid");
	if (humanoid === undefined || path.size() < 2) return;

	humanoid.WalkSpeed = 16;
	for (let index = 1; index < path.size(); index += 1) {
		const point = path[index];
		if (point === undefined) continue;
		walkTo(humanoid, fromWorldPoint(point));
	}

	const last = path[path.size() - 1];
	if (last !== undefined) snapToWorld(model, fromWorldPoint(last));
}

function getAnimator(model: Model): Animator | undefined {
	const humanoid = model.FindFirstChildOfClass("Humanoid");
	if (humanoid === undefined) return undefined;
	const existing = humanoid.FindFirstChildOfClass("Animator");
	if (existing !== undefined) return existing;
	const animator = new Instance("Animator");
	animator.Parent = humanoid;
	return animator;
}

function playCombatAnim(model: Model, payload: CombatAnim): void {
	faceToward(model, payload.targetGuid);
	const animator = getAnimator(model);
	if (animator === undefined) {
		task.wait(0.35);
		return;
	}

	const animation = new Instance("Animation");
	animation.AnimationId = COMBAT_ANIMATIONS[payload.anim];
	const [ok, loaded] = pcall(() => animator.LoadAnimation(animation));
	animation.Destroy();
	if (!ok || !typeIs(loaded, "Instance") || !loaded.IsA("AnimationTrack")) {
		task.wait(0.35);
		return;
	}

	loaded.Priority = Enum.AnimationPriority.Action;
	loaded.Play();
	if (loaded.Length === 0) task.wait(0.05);
	const duration = math.clamp(loaded.Length > 0 ? loaded.Length * 0.55 : 0.4, 0.25, 0.8);
	task.wait(duration);
}

function enqueue(event: PresentationEvent): void {
	if (activeEncounterId !== undefined && event.payload.encounterId !== activeEncounterId) {
		return;
	}
	queue.push(event);
	if (!presenting) task.spawn(processQueue);
}

function processQueue(): void {
	presenting = true;
	while (queue.size() > 0) {
		const event = queue.shift();
		if (event === undefined) continue;
		if (activeEncounterId !== undefined && event.payload.encounterId !== activeEncounterId) {
			continue;
		}

		const model = waitForModel(event.payload.guid);
		if (model === undefined) continue;

		if (event.kind === "move") {
			walkPath(model, event.payload.path);
		} else {
			playCombatAnim(model, event.payload);
		}
	}
	presenting = false;
}

export function isLocomotionBusy(): boolean {
	return presenting || queue.size() > 0;
}

export function setActiveEncounter(encounterId: string | undefined): void {
	if (encounterId !== undefined && encounterId !== activeEncounterId) {
		queue.clear();
	}
	activeEncounterId = encounterId;
}

export function startCombatActors(): void {
	Net.combatMove.setCallback((untrusted) => {
		enqueue({ kind: "move", payload: assertCombatMove(untrusted) });
	});
	Net.combatAnim.setCallback((untrusted) => {
		enqueue({ kind: "anim", payload: assertCombatAnim(untrusted) });
	});
}
