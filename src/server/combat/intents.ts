import type { CombatAction, EvadeInput } from "shared/net/types";

export interface QueuedEvadeInput {
	player: Player;
	input: EvadeInput;
	arrivedAt: number;
}

export interface QueuedCombatAction {
	player: Player;
	input: CombatAction;
}

const networkEvadeInputs: QueuedEvadeInput[] = [];
const networkCombatActions: QueuedCombatAction[] = [];

const pendingEvadeInputs: QueuedEvadeInput[] = [];
const pendingCombatActions: QueuedCombatAction[] = [];

const MAX_TOTAL_QUEUED = 128;
const MAX_EVADE_INPUTS_PER_PLAYER = 8;
const MAX_ACTIONS_PER_PLAYER = 4;

export function queueEvadeInput(input: QueuedEvadeInput): void {
	if (networkEvadeInputs.size() >= MAX_TOTAL_QUEUED) return;
	let playerInputs = 0;
	for (const queued of networkEvadeInputs) {
		if (queued.player === input.player) playerInputs += 1;
	}
	if (playerInputs >= MAX_EVADE_INPUTS_PER_PLAYER) return;
	networkEvadeInputs.push(input);
}

export function queueCombatAction(input: QueuedCombatAction): void {
	if (networkCombatActions.size() >= MAX_TOTAL_QUEUED) return;
	let playerActions = 0;
	for (const queued of networkCombatActions) {
		if (queued.player === input.player) playerActions += 1;
	}
	if (playerActions >= MAX_ACTIONS_PER_PLAYER) return;
	networkCombatActions.push(input);
}

/** Input-phase handoff: network callbacks never mutate simulation state. */
export function drainNetworkIntents(): void {
	for (const input of networkEvadeInputs) pendingEvadeInputs.push(input);
	networkEvadeInputs.clear();
	for (const action of networkCombatActions) pendingCombatActions.push(action);
	networkCombatActions.clear();
}

export function takeEvadeInputs(): QueuedEvadeInput[] {
	const drained = [...pendingEvadeInputs];
	pendingEvadeInputs.clear();
	return drained;
}

export function takeCombatActions(): QueuedCombatAction[] {
	const drained = [...pendingCombatActions];
	pendingCombatActions.clear();
	return drained;
}
