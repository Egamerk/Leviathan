import { ReplicatedStorage } from "@rbxts/services";
import type {
	CombatAction,
	CombatAnim,
	CombatantSnapshot,
	CombatMove,
	EncounterSnapshot,
	EvadeInput,
	EvadeResult,
	EvadeSchedule,
} from "./types";

interface ClientNetwork {
	sendEvents: () => void;
	replicateCombatant: {
		setCallback: (callback: (value: CombatantSnapshot) => void) => () => void;
	};
	replicateEncounter: {
		setCallback: (callback: (value: EncounterSnapshot) => void) => () => void;
	};
	evadeSchedule: {
		setCallback: (callback: (value: EvadeSchedule) => void) => () => void;
	};
	evadeResult: {
		setCallback: (callback: (value: EvadeResult) => void) => () => void;
	};
	combatMove: {
		setCallback: (callback: (value: CombatMove) => void) => () => void;
	};
	combatAnim: {
		setCallback: (callback: (value: CombatAnim) => void) => () => void;
	};
	ready: {
		fire: () => void;
	};
	evadeInput: {
		fire: (value: EvadeInput) => void;
	};
	combatAction: {
		fire: (value: CombatAction) => void;
	};
	syncClock: {
		call: () => number;
	};
}

const networkFolder = ReplicatedStorage.WaitForChild("Network");
const network = require(networkFolder.WaitForChild("Client") as ModuleScript) as ClientNetwork;

export default network;
