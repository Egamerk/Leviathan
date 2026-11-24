import { Players, Workspace } from "@rbxts/services";
import { gameBus } from "shared/ecs/bus";
import Net from "shared/net/server";
import {
	assertCombatAction,
	assertCombatAnim,
	assertCombatantSnapshot,
	assertCombatMove,
	assertEncounterSnapshot,
	assertEvadeInput,
	assertEvadeResult,
	assertEvadeSchedule,
} from "shared/net/validators";
import {
	applyCombatantSnapshot,
	removeCombatantState,
} from "shared/state/combatants";
import { getSession } from "server/services/profile";
import { readCombatantState } from "server/combat/combatantState";
import { queueCombatAction, queueEvadeInput } from "server/combat/intents";
import type { EncounterSnapshot } from "shared/net/types";

const readyPlayers = new Set<number>();
const latestEncounters = new Map<number, EncounterSnapshot>();

function replicateCombatant(userId: number, state: ReturnType<typeof assertCombatantSnapshot>): void {
	const player = Players.GetPlayerByUserId(userId);
	if (player === undefined || !readyPlayers.has(userId)) return;

	Net.replicateCombatant.fire(player, assertCombatantSnapshot(state));
}

function replicateEncounter(userId: number, snapshot: EncounterSnapshot): void {
	latestEncounters.set(userId, snapshot);
	const player = Players.GetPlayerByUserId(userId);
	if (player === undefined || !readyPlayers.has(userId)) return;

	Net.replicateEncounter.fire(player, assertEncounterSnapshot(snapshot));
}

/** The only server system that knows clients or Zap exist. */
export function startReplicationSystem(): void {
	Net.syncClock.setCallback(() => Workspace.GetServerTimeNow());
	Net.evadeInput.setCallback((player, untrustedInput) => {
		queueEvadeInput({
			player,
			input: assertEvadeInput(untrustedInput),
			arrivedAt: Workspace.GetServerTimeNow(),
		});
	});
	Net.combatAction.setCallback((player, untrustedInput) => {
		queueCombatAction({ player, input: assertCombatAction(untrustedInput) });
	});
	Net.ready.setCallback((player) => {
		readyPlayers.add(player.UserId);

		const session = getSession(player.UserId);
		if (session !== undefined) {
			const state = readCombatantState(session.combatantEntity);
			if (state !== undefined) replicateCombatant(player.UserId, state);
		}

		const encounter = latestEncounters.get(player.UserId);
		if (encounter !== undefined) {
			Net.replicateEncounter.fire(player, assertEncounterSnapshot(encounter));
		}
	});

	gameBus.subscribe("PlayerLoaded", ({ userId, state }) => {
		applyCombatantSnapshot(state);
		replicateCombatant(userId, state);
	});

	gameBus.subscribe("CombatantChanged", ({ userId, state }) => {
		applyCombatantSnapshot(state);
		replicateCombatant(userId, state);
	});

	gameBus.subscribe("EncounterChanged", ({ userId, snapshot }) => {
		replicateEncounter(userId, snapshot);
	});

	gameBus.subscribe("EvadeScheduled", ({ userId, schedule }) => {
		const player = Players.GetPlayerByUserId(userId);
		if (player !== undefined && readyPlayers.has(userId)) {
			Net.evadeSchedule.fire(player, assertEvadeSchedule(schedule));
		}
	});

	gameBus.subscribe("EvadeResolved", ({ userId, result }) => {
		const player = Players.GetPlayerByUserId(userId);
		if (player !== undefined && readyPlayers.has(userId)) {
			Net.evadeResult.fire(player, assertEvadeResult(result));
		}
	});

	gameBus.subscribe("CombatMovePresented", ({ userId, move }) => {
		const player = Players.GetPlayerByUserId(userId);
		if (player !== undefined && readyPlayers.has(userId)) {
			Net.combatMove.fire(player, assertCombatMove(move));
		}
	});

	gameBus.subscribe("CombatAnimPresented", ({ userId, anim }) => {
		const player = Players.GetPlayerByUserId(userId);
		if (player !== undefined && readyPlayers.has(userId)) {
			Net.combatAnim.fire(player, assertCombatAnim(anim));
		}
	});

	gameBus.subscribe("EntityDespawned", ({ userId, guid }) => {
		removeCombatantState(guid);
		latestEncounters.delete(userId);
	});

	Players.PlayerRemoving.Connect((player) => {
		readyPlayers.delete(player.UserId);
		latestEncounters.delete(player.UserId);
	});
}
