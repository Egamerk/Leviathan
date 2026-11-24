import { Players, Workspace } from "@rbxts/services";

const ACTORS_FOLDER = "CombatActors";
const GUID_ATTRIBUTE = "CombatantGuid";

interface EncounterActors {
	userId: number;
	playerGuid: string;
	enemyGuid: string;
	playerPos: Vector3;
	enemyPos: Vector3;
	enemy?: Model;
	characterAdded?: RBXScriptConnection;
}

const actorsByUserId = new Map<number, EncounterActors>();

function actorsFolder(): Folder {
	const existing = Workspace.FindFirstChild(ACTORS_FOLDER);
	if (existing?.IsA("Folder") === true) return existing;

	const folder = new Instance("Folder");
	folder.Name = ACTORS_FOLDER;
	folder.Parent = Workspace;
	return folder;
}

function hipOffset(model: Model): number {
	const humanoid = model.FindFirstChildOfClass("Humanoid");
	const root = model.FindFirstChild("HumanoidRootPart");
	if (root?.IsA("BasePart") !== true) return 3;
	return (humanoid?.HipHeight ?? 2) + root.Size.Y / 2;
}

export function modelGroundPosition(model: Model): Vector3 {
	const root = model.FindFirstChild("HumanoidRootPart");
	if (root?.IsA("BasePart") !== true) return new Vector3(0, 0, 0);

	const params = new RaycastParams();
	params.FilterType = Enum.RaycastFilterType.Exclude;
	params.FilterDescendantsInstances = [model];
	const hit = Workspace.Raycast(root.Position, new Vector3(0, -80, 0), params);
	if (hit !== undefined) return hit.Position;
	return new Vector3(root.Position.X, root.Position.Y - hipOffset(model), root.Position.Z);
}

export function groundPositionAt(position: Vector3, ignore?: Instance): Vector3 {
	const origin = new Vector3(position.X, position.Y + 8, position.Z);
	const params = new RaycastParams();
	params.FilterType = Enum.RaycastFilterType.Exclude;
	if (ignore !== undefined) params.FilterDescendantsInstances = [ignore];
	const hit = Workspace.Raycast(origin, new Vector3(0, -120, 0), params);
	return hit !== undefined ? hit.Position : new Vector3(position.X, position.Y, position.Z);
}

export function placeModelAt(model: Model, ground: Vector3, face?: Vector3): void {
	const position = new Vector3(ground.X, ground.Y + hipOffset(model), ground.Z);
	const lookAt =
		face !== undefined ? new Vector3(face.X, position.Y, face.Z) : position.add(new Vector3(1, 0, 0));
	if (lookAt.sub(position).Magnitude < 0.05) {
		model.PivotTo(new CFrame(position));
		return;
	}
	model.PivotTo(CFrame.lookAt(position, lookAt));
}

function configureCombatHumanoid(model: Model): void {
	const humanoid = model.FindFirstChildOfClass("Humanoid");
	if (humanoid === undefined) return;
	humanoid.WalkSpeed = 16;
	humanoid.JumpPower = 0;
	humanoid.JumpHeight = 0;
	humanoid.AutoRotate = true;
	humanoid.BreakJointsOnDeath = false;
}

function createFallbackEnemy(guid: string): Model {
	const model = new Instance("Model");
	model.Name = "Enemy";
	model.SetAttribute(GUID_ATTRIBUTE, guid);

	const root = new Instance("Part");
	root.Name = "HumanoidRootPart";
	root.Size = new Vector3(2, 2, 1);
	root.Transparency = 1;
	root.CanCollide = false;
	root.Anchored = false;
	root.Parent = model;

	const body = new Instance("Part");
	body.Name = "UpperTorso";
	body.Size = new Vector3(2, 2, 1);
	body.Color = Color3.fromRGB(170, 45, 45);
	body.Parent = model;

	const weld = new Instance("WeldConstraint");
	weld.Part0 = root;
	weld.Part1 = body;
	weld.Parent = root;

	const humanoid = new Instance("Humanoid");
	humanoid.DisplayName = "Foe";
	humanoid.Parent = model;
	const animator = new Instance("Animator");
	animator.Parent = humanoid;

	model.PrimaryPart = root;
	model.Parent = actorsFolder();
	configureCombatHumanoid(model);
	return model;
}

function createEnemyModel(guid: string): Model {
	const description = new Instance("HumanoidDescription");
	description.HeadColor = Color3.fromRGB(170, 45, 45);
	description.TorsoColor = Color3.fromRGB(140, 35, 35);
	description.LeftArmColor = Color3.fromRGB(170, 45, 45);
	description.RightArmColor = Color3.fromRGB(170, 45, 45);
	description.LeftLegColor = Color3.fromRGB(90, 25, 25);
	description.RightLegColor = Color3.fromRGB(90, 25, 25);

	const [ok, created] = pcall(() =>
		Players.CreateHumanoidModelFromDescription(description, Enum.HumanoidRigType.R15),
	);
	description.Destroy();

	if (!ok || !typeIs(created, "Instance") || !created.IsA("Model")) {
		return createFallbackEnemy(guid);
	}

	created.Name = "Enemy";
	created.SetAttribute(GUID_ATTRIBUTE, guid);
	created.Parent = actorsFolder();
	configureCombatHumanoid(created);
	return created;
}

function bindPlayerCharacter(binding: EncounterActors, character: Model, relocate: boolean): void {
	character.SetAttribute(GUID_ATTRIBUTE, binding.playerGuid);
	configureCombatHumanoid(character);
	if (relocate) {
		placeModelAt(character, binding.playerPos, binding.enemyPos);
		return;
	}

	const root = character.FindFirstChild("HumanoidRootPart");
	if (root?.IsA("BasePart") !== true) return;
	const look = new Vector3(binding.enemyPos.X, root.Position.Y, binding.enemyPos.Z);
	if (look.sub(root.Position).Magnitude < 0.05) return;
	character.PivotTo(CFrame.lookAt(root.Position, look));
}

export function spawnEncounterActors(
	userId: number,
	playerGuid: string,
	enemyGuid: string,
	playerPos: Vector3,
	enemyPos: Vector3,
): void {
	destroyEncounterActors(userId);

	const binding: EncounterActors = {
		userId,
		playerGuid,
		enemyGuid,
		playerPos,
		enemyPos,
	};
	actorsByUserId.set(userId, binding);

	const player = Players.GetPlayerByUserId(userId);
	if (player !== undefined) {
		if (player.Character !== undefined) {
			bindPlayerCharacter(binding, player.Character, false);
		}
		binding.characterAdded = player.CharacterAdded.Connect((character) => {
			if (actorsByUserId.get(userId) !== binding) return;
			bindPlayerCharacter(binding, character, true);
		});
	}

	task.spawn(() => {
		if (actorsByUserId.get(userId) !== binding) return;
		const enemy = createEnemyModel(enemyGuid);
		if (actorsByUserId.get(userId) !== binding) {
			enemy.Destroy();
			return;
		}
		binding.enemy = enemy;
		placeModelAt(enemy, enemyPos, playerPos);
		const owner = Players.GetPlayerByUserId(userId);
		const root = enemy.FindFirstChild("HumanoidRootPart");
		if (owner !== undefined && root?.IsA("BasePart") === true) {
			root.SetNetworkOwner(owner);
		}
	});
}

export function destroyEncounterActors(userId: number, expectedEnemyGuid?: string): void {
	const binding = actorsByUserId.get(userId);
	if (binding === undefined) return;
	if (expectedEnemyGuid !== undefined && binding.enemyGuid !== expectedEnemyGuid) return;

	binding.characterAdded?.Disconnect();
	binding.enemy?.Destroy();

	const player = Players.GetPlayerByUserId(userId);
	const character = player?.Character;
	if (character !== undefined && character.GetAttribute(GUID_ATTRIBUTE) === binding.playerGuid) {
		character.SetAttribute(GUID_ATTRIBUTE, undefined);
		const humanoid = character.FindFirstChildOfClass("Humanoid");
		if (humanoid !== undefined) {
			humanoid.WalkSpeed = 16;
			humanoid.JumpPower = 50;
			humanoid.JumpHeight = 7.2;
		}
	}

	actorsByUserId.delete(userId);
}
