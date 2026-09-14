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

interface ServerNetwork {
	sendEvents: () => void;
	replicateCombatant: {
		fire: (player: Player, value: CombatantSnapshot) => void;
	};
	replicateEncounter: {
		fire: (player: Player, value: EncounterSnapshot) => void;
	};
	evadeSchedule: {
		fire: (player: Player, value: EvadeSchedule) => void;
	};
	evadeResult: {
		fire: (player: Player, value: EvadeResult) => void;
	};
	combatMove: {
		fire: (player: Player, value: CombatMove) => void;
	};
	combatAnim: {
		fire: (player: Player, value: CombatAnim) => void;
	};
	ready: {
		setCallback: (callback: (player: Player) => void) => () => void;
	};
	evadeInput: {
		setCallback: (callback: (player: Player, value: EvadeInput) => void) => () => void;
	};
	combatAction: {
		setCallback: (callback: (player: Player, value: CombatAction) => void) => () => void;
	};
	syncClock: {
		setCallback: (callback: (player: Player) => number) => () => void;
	};
}

const networkFolder = ReplicatedStorage.WaitForChild("Network");
const network = require(networkFolder.WaitForChild("Server") as ModuleScript) as ServerNetwork;

export default network;
