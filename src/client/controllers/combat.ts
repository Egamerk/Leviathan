import { ContextActionService, Workspace } from "@rbxts/services";
import type { ReactionType } from "shared/data/abilities";
import Net from "shared/net/client";
import type { EvadeSchedule, EvadeWindowSchedule } from "shared/net/types";
import { assertEvadeResult, assertEvadeSchedule } from "shared/net/validators";
import { evadeWindowAtom, setEvadeWindow } from "shared/state/evade";
import { encounterAtom } from "shared/state/encounter";
import {
	cancelCombatIntent,
	clearCombatIntent,
	combatIntentAtom,
	selectAttackAbility,
	selectMoveMode,
} from "shared/state/combatIntent";

const MAX_CLOCK_RTT = 1;

let activeSchedule: EvadeSchedule | undefined;
let activeWindow: EvadeWindowSchedule | undefined;
let scheduleGeneration = 0;
let serverClockOffset: number | undefined;

function synchronizedNow(): number {
	return serverClockOffset !== undefined ? os.clock() + serverClockOffset : Workspace.GetServerTimeNow();
}

function syncClock(): void {
	const startedAt = os.clock();
	const serverTime = Net.syncClock.call();
	const finishedAt = os.clock();
	const rtt = finishedAt - startedAt;
	if (rtt <= MAX_CLOCK_RTT) {
		serverClockOffset = serverTime - (startedAt + finishedAt) / 2;
	}
}

function showSchedule(schedule: EvadeSchedule): void {
	activeSchedule = schedule;
	scheduleGeneration += 1;
	const generation = scheduleGeneration;

	for (const window of schedule.windows) {
		task.delay(math.max(0, window.telegraphAt - synchronizedNow()), () => {
			if (generation !== scheduleGeneration) return;
			setEvadeWindow({
				encounterId: schedule.encounterId,
				windowId: window.windowId,
				reaction: window.reaction,
				openAt: window.openAt,
				closeAt: window.closeAt,
				opened: false,
				resolved: false,
			});
		});

		task.delay(math.max(0, window.openAt - synchronizedNow()), () => {
			if (generation !== scheduleGeneration) return;
			activeWindow = window;
			setEvadeWindow({
				encounterId: schedule.encounterId,
				windowId: window.windowId,
				reaction: window.reaction,
				openAt: window.openAt,
				closeAt: window.closeAt,
				opened: true,
				resolved: false,
			});
		});

		task.delay(math.max(0, window.closeAt - synchronizedNow()), () => {
			if (generation !== scheduleGeneration || activeWindow?.windowId !== window.windowId) return;
			activeWindow = undefined;
		});
	}
}

function fireReaction(reaction: ReactionType): void {
	const schedule = activeSchedule;
	const window = activeWindow;
	if (schedule === undefined || window === undefined) return;

	Net.evadeInput.fire({
		encounterId: schedule.encounterId,
		windowId: window.windowId,
		reaction,
		clientPressTime: synchronizedNow(),
	});
}

function isPlayerTurn(): boolean {
	const encounter = encounterAtom();
	return encounter !== undefined && encounter.phase === "awaitingAction" && encounter.actor === "player";
}

export function confirmCombatIntent(): boolean {
	const encounter = encounterAtom();
	const intent = combatIntentAtom();
	if (encounter === undefined || encounter.phase !== "awaitingAction" || encounter.actor !== "player") {
		return false;
	}

	if (intent.mode === "attack" && intent.targetGuid !== undefined) {
		Net.combatAction.fire({
			action: "attack",
			abilityId: intent.abilityId ?? "basicAttack",
			targetGuid: intent.targetGuid,
		});
		clearCombatIntent();
		return true;
	}

	if (
		intent.mode === "move" &&
		intent.destX !== undefined &&
		intent.destY !== undefined &&
		intent.destZ !== undefined
	) {
		Net.combatAction.fire({
			action: "move",
			destX: intent.destX,
			destY: intent.destY,
			destZ: intent.destZ,
		});
		clearCombatIntent();
		return true;
	}

	return false;
}

export function endPlayerTurn(): void {
	if (!isPlayerTurn()) return;
	cancelCombatIntent();
	Net.combatAction.fire({ action: "endTurn" });
}

function bindInputs(): void {
	ContextActionService.BindAction(
		"CombatParry",
		(_, state) => {
			if (state === Enum.UserInputState.Begin) fireReaction("parry");
			return Enum.ContextActionResult.Sink;
		},
		false,
		Enum.KeyCode.Q,
	);
	ContextActionService.BindAction(
		"CombatDodge",
		(_, state) => {
			if (state === Enum.UserInputState.Begin) fireReaction("dodge");
			return Enum.ContextActionResult.Sink;
		},
		false,
		Enum.KeyCode.E,
	);

	ContextActionService.BindAction(
		"CombatSelectAttack",
		(_, state) => {
			if (state === Enum.UserInputState.Begin && isPlayerTurn()) selectAttackAbility("basicAttack");
			return Enum.ContextActionResult.Sink;
		},
		false,
		Enum.KeyCode.F,
	);
	ContextActionService.BindAction(
		"CombatSelectMove",
		(_, state) => {
			if (state === Enum.UserInputState.Begin && isPlayerTurn()) selectMoveMode();
			return Enum.ContextActionResult.Sink;
		},
		false,
		Enum.KeyCode.M,
	);
	ContextActionService.BindAction(
		"CombatConfirm",
		(_, state) => {
			if (state === Enum.UserInputState.Begin && isPlayerTurn()) confirmCombatIntent();
			return Enum.ContextActionResult.Sink;
		},
		false,
		Enum.KeyCode.Return,
	);
	ContextActionService.BindAction(
		"CombatCancel",
		(_, state) => {
			if (state === Enum.UserInputState.Begin) cancelCombatIntent();
			return Enum.ContextActionResult.Sink;
		},
		false,
		Enum.KeyCode.Escape,
	);
	ContextActionService.BindAction(
		"CombatEndTurn",
		(_, state) => {
			if (state === Enum.UserInputState.Begin) endPlayerTurn();
			return Enum.ContextActionResult.Sink;
		},
		false,
		Enum.KeyCode.T,
	);
}

export function startCombatController(): void {
	Net.evadeSchedule.setCallback((untrustedSchedule) => {
		showSchedule(assertEvadeSchedule(untrustedSchedule));
	});
	Net.evadeResult.setCallback((untrustedResult) => {
		const result = assertEvadeResult(untrustedResult);
		const window = activeSchedule?.windows.find((candidate) => candidate.windowId === result.windowId);
		if (window !== undefined && evadeWindowAtom()?.windowId === result.windowId) {
			setEvadeWindow({
				encounterId: result.encounterId,
				windowId: result.windowId,
				reaction: window.reaction,
				openAt: window.openAt,
				closeAt: window.closeAt,
				opened: true,
				resolved: true,
				success: result.success,
			});
		}
		if (activeWindow?.windowId === result.windowId) activeWindow = undefined;
		task.delay(0.2, () => {
			if (evadeWindowAtom()?.windowId === result.windowId) setEvadeWindow(undefined);
		});
	});

	bindInputs();
	task.spawn(syncClock);
}
