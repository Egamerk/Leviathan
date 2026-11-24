import { subscribe } from "@rbxts/charm";
import { Players, UserInputService, Workspace } from "@rbxts/services";
import {
	type ClientCombatant,
	combatants,
	encounterId,
	gameMode,
	isMyTurn,
	lastResult,
	myCombatant,
	selectedAbility,
	showToast,
	suspicion,
	turn,
	turnOrder,
} from "client/store";
import type { CombatEvent } from "shared/combat/types";
import { CombatConfig, DetectionConfig } from "shared/config";
import { getAbility } from "shared/data/abilities";
import type { NodeId, VoxelGrid } from "shared/nav/grid";
import { reachable, type ReachableSet } from "shared/nav/pathfinder";
import { restoreArena } from "shared/nav/snapshot";
import { ClientNet } from "shared/net/client";

/**
 * Client half of an encounter:
 *  - mirrors server state from `combatEvents` into Charm atoms (for the HUD)
 *  - rebuilds the arena grid from the snapshot and draws the move-range overlay
 *    with the *same* Dijkstra the server validates against
 *  - turns clicks/keys into `combatCommand`s (the server is the authority)
 *
 * Also handles the exploration-side "strike first" input (E near an unaware enemy).
 */

const player = Players.LocalPlayer;
const mouse = player.GetMouse();

let grid: VoxelGrid | undefined;
let range: ReachableSet | undefined;
const overlayFolder = new Instance("Folder");
overlayFolder.Name = "CombatOverlay";
const tilePool = new Array<Part>();
let hoverTile: Part | undefined;

// ── State mirror ────────────────────────────────────────────────────────────

function updateCombatant(id: string, patch: Partial<ClientCombatant>) {
	const current = combatants().get(id);
	if (current === undefined) return;
	const updated = new Map<string, ClientCombatant>();
	for (const [key, value] of combatants()) updated.set(key, value);
	updated.set(id, { ...current, ...patch });
	combatants(updated);
}

function applyEvent(event: CombatEvent) {
	const t = turn();
	switch (event.type) {
		case "RoundStarted":
			turnOrder(event.order);
			break;
		case "TurnStarted":
			turn({ actorId: event.actorId, round: event.round, mainUsed: false, sideUsed: false });
			break;
		case "Moved":
			updateCombatant(event.actorId, { node: event.path[event.path.size() - 1] });
			if (!event.auto && t) turn({ ...t, sideUsed: true });
			break;
		case "AbilityStarted": {
			const slot = getAbility(event.abilityId)?.slot;
			if (t) turn({ ...t, mainUsed: t.mainUsed || slot === "main", sideUsed: t.sideUsed || slot === "side" });
			break;
		}
		case "Recovered": {
			const c = combatants().get(event.actorId);
			if (c) {
				updateCombatant(event.actorId, {
					health: { ...c.health, current: event.health },
					stamina: { ...c.stamina, current: event.stamina },
					reservoir:
						c.reservoir && event.reservoir !== undefined
							? { ...c.reservoir, current: event.reservoir }
							: c.reservoir,
				});
			}
			if (t) turn({ ...t, mainUsed: true });
			break;
		}
		case "ResourcesChanged": {
			const c = combatants().get(event.actorId);
			if (c) {
				updateCombatant(event.actorId, {
					stamina: { ...c.stamina, current: event.stamina },
					auxiliary: { ...c.auxiliary, current: event.auxiliary },
					reservoir:
						c.reservoir && event.reservoir !== undefined
							? { ...c.reservoir, current: event.reservoir }
							: c.reservoir,
				});
			}
			break;
		}
		case "Damaged": {
			const c = combatants().get(event.targetId);
			if (c) updateCombatant(event.targetId, { health: { ...c.health, current: event.health } });
			if (c?.isMe) showToast(`-${string.format("%.2f", event.amount)} (${event.limb})`);
			break;
		}
		case "Downed":
			updateCombatant(event.targetId, { condition: event.condition });
			break;
		case "Parried":
			showToast(
				event.outcome === "Parried"
					? "Parried!"
					: event.outcome === "Shattered"
						? "Block shattered"
						: "Block shattered — Staggered!",
			);
			break;
		case "Dodged":
			showToast(combatants().get(event.targetId)?.isMe ? "Dodged!" : "Evaded");
			break;
		case "StatusTicked":
			if (event.damage > 0) showToast(`${event.label} ${string.format("%.2f", event.damage)}`);
			break;
		case "TurnSkipped":
			if (combatants().get(event.actorId)?.isMe)
				showToast(event.reason === "Staggered" ? "Staggered — turn lost" : "You are down");
			break;
	}
}

// ── Overlay ─────────────────────────────────────────────────────────────────

function tile(index: number): Part {
	let part = tilePool[index];
	if (part === undefined) {
		part = new Instance("Part");
		part.Anchored = true;
		part.CanCollide = false;
		part.CanQuery = false;
		part.CastShadow = false;
		part.Material = Enum.Material.Neon;
		part.Color = Color3.fromRGB(80, 200, 255);
		part.Transparency = 0.75;
		part.Parent = overlayFolder;
		tilePool[index] = part;
	}
	return part;
}

function clearOverlay() {
	for (const part of tilePool) part.Parent = undefined;
	range = undefined;
}

function syncBlocked(g: VoxelGrid) {
	g.clearBlocked();
	for (const [, c] of combatants()) if (c.condition === "active" && !c.isMe) g.block(c.node);
}

function tooCloseToEnemy(g: VoxelGrid, node: NodeId): boolean {
	const position = g.nodePosition(node);
	for (const [, c] of combatants()) {
		if (c.side === "diver" || c.condition !== "active") continue;
		if (g.nodePosition(c.node).sub(position).Magnitude < CombatConfig.personalSpace) return true;
	}
	return false;
}

function refreshOverlay() {
	clearOverlay();
	const me = myCombatant();
	const t = turn();
	if (grid === undefined || me === undefined || t === undefined || !isMyTurn() || t.sideUsed) return;

	syncBlocked(grid);
	range = reachable(grid, me.node, me.moveStuds);
	let index = 0;
	for (const [node] of range.cost) {
		if (node === me.node || tooCloseToEnemy(grid, node)) continue;
		const part = tile(index++);
		part.Size = new Vector3(grid.cellSize * 0.85, 0.15, grid.cellSize * 0.85);
		part.CFrame = new CFrame(grid.nodePosition(node).add(new Vector3(0, 0.1, 0)));
		part.Parent = overlayFolder;
	}
}

// ── Input ───────────────────────────────────────────────────────────────────

function combatantFromHit(hit: BasePart | undefined): ClientCombatant | undefined {
	if (hit === undefined) return undefined;
	for (const [, c] of combatants()) if (c.model !== undefined && hit.IsDescendantOf(c.model)) return c;
	return undefined;
}

function onClick() {
	if (gameMode() !== "Combat" || !isMyTurn() || grid === undefined) return;
	const t = turn()!;

	const clicked = combatantFromHit(mouse.Target);
	if (clicked !== undefined && clicked.side === "enemy" && clicked.condition === "active") {
		if (t.mainUsed) return showToast("Main action already used");
		ClientNet.combatCommand.fire({ type: "UseAbility", abilityId: selectedAbility(), targetId: clicked.id });
		return;
	}

	if (t.sideUsed) return;
	const node = grid.nodeAt(mouse.Hit.Position, 2);
	if (node === undefined || range === undefined || !range.cost.has(node) || tooCloseToEnemy(grid, node)) {
		return showToast("Can't move there");
	}
	ClientNet.combatCommand.fire({ type: "Move", to: node });
}

function onHover() {
	if (hoverTile === undefined) {
		hoverTile = new Instance("Part");
		hoverTile.Anchored = true;
		hoverTile.CanCollide = false;
		hoverTile.CanQuery = false;
		hoverTile.Material = Enum.Material.Neon;
		hoverTile.Color = Color3.fromRGB(255, 255, 255);
		hoverTile.Transparency = 0.4;
	}
	const node = grid && range ? grid.nodeAt(mouse.Hit.Position, 2) : undefined;
	if (grid === undefined || node === undefined || range === undefined || !range.cost.has(node)) {
		hoverTile.Parent = undefined;
		return;
	}
	hoverTile.Size = new Vector3(grid.cellSize * 0.9, 0.2, grid.cellSize * 0.9);
	hoverTile.CFrame = new CFrame(grid.nodePosition(node).add(new Vector3(0, 0.12, 0)));
	hoverTile.Parent = overlayFolder;
}

/** Explore-mode: E near an unaware enemy starts a Diver stealth encounter. */
function tryEngage() {
	const root = player.Character?.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
	const folder = Workspace.FindFirstChild("Enemies");
	if (root === undefined || folder === undefined) return;
	for (const model of folder.GetChildren()) {
		const id = model.GetAttribute("EnemyId");
		const enemyRoot = model.FindFirstChild("HumanoidRootPart") as BasePart | undefined;
		if (!typeIs(id, "string") || enemyRoot === undefined) continue;
		if (enemyRoot.Position.sub(root.Position).Magnitude <= DetectionConfig.engageRange) {
			ClientNet.engageEnemy.fire({ enemyId: id });
			return;
		}
	}
}

function onKey(input: InputObject) {
	if (gameMode() === "Explore") {
		if (input.KeyCode === Enum.KeyCode.E) tryEngage();
		return;
	}
	if (!isMyTurn()) return;
	const me = myCombatant()!;
	const keys: Enum.KeyCode[] = [Enum.KeyCode.One, Enum.KeyCode.Two, Enum.KeyCode.Three, Enum.KeyCode.Four];
	const index = keys.indexOf(input.KeyCode);
	if (index >= 0 && me.abilities[index] !== undefined) {
		selectedAbility(me.abilities[index]);
	} else if (input.KeyCode === Enum.KeyCode.R) {
		ClientNet.combatCommand.fire({ type: "Recover" });
	} else if (input.KeyCode === Enum.KeyCode.Return) {
		ClientNet.combatCommand.fire({ type: "EndTurn" });
	}
}

// ── Public helpers for the HUD ──────────────────────────────────────────────

export function sendRecover() {
	ClientNet.combatCommand.fire({ type: "Recover" });
}

export function sendEndTurn() {
	ClientNet.combatCommand.fire({ type: "EndTurn" });
}

// ── Wiring ──────────────────────────────────────────────────────────────────

export function startEncounterController() {
	overlayFolder.Parent = Workspace.CurrentCamera;
	mouse.TargetFilter = overlayFolder;

	ClientNet.encounterStarted.setCallback((data) => {
		grid = restoreArena(data.arena);
		const map = new Map<string, ClientCombatant>();
		for (const view of data.combatants) {
			map.set(view.id, {
				id: view.id,
				name: view.name,
				side: view.side,
				isMe: view.userId === player.UserId,
				node: view.node,
				health: view.health,
				stamina: view.stamina,
				reservoir: view.reservoir,
				auxiliary: view.auxiliary,
				moveStuds: view.moveStuds,
				abilities: view.abilities,
				condition: "active",
				model: view.model,
			});
		}
		combatants(map);
		encounterId(data.encounterId);
		lastResult(undefined);
		suspicion(0);
		gameMode("Combat");
		showToast(
			data.kind === "EnemyAmbush"
				? "Ambushed!"
				: data.kind === "DiverStealth"
					? "You strike first!"
					: "Encounter!",
			2.5,
		);
	});

	ClientNet.combatEvents.setCallback((data) => {
		if (data.encounterId !== encounterId()) return;
		for (const event of data.events as CombatEvent[]) applyEvent(event);
	});

	ClientNet.encounterEnded.setCallback((data) => {
		if (data.encounterId !== encounterId()) return;
		lastResult(data.winner === "diver" ? "Victory" : "Defeat");
		task.delay(2, () => lastResult(undefined));
		grid = undefined;
		clearOverlay();
		if (hoverTile) hoverTile.Parent = undefined;
		encounterId(undefined);
		turn(undefined);
		combatants(new Map());
		gameMode("Explore");
	});

	ClientNet.awareness.setCallback((data) => {
		suspicion(data.state === "Pursuing" ? 1 : data.suspicion);
		if (data.state === "Idle") suspicion(0);
	});

	// Re-draw the range whenever whose-turn / positions change.
	subscribe(turn, refreshOverlay);
	subscribe(combatants, refreshOverlay);

	mouse.Button1Down.Connect(onClick);
	mouse.Move.Connect(() => {
		if (gameMode() === "Combat") onHover();
	});
	UserInputService.InputBegan.Connect((input, processed) => {
		if (!processed) onKey(input);
	});
}
