import { ReplicatedStorage } from "@rbxts/services";
<<<<<<< HEAD
<<<<<<< HEAD
import type * as ZapClient from "./zapClient";

/** Typed handle to the Zap-generated client module (see server.ts). */
const module = ReplicatedStorage.WaitForChild("Network").WaitForChild("Client") as ModuleScript;
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Zap output is a plain ModuleScript
export const ClientNet = require(module) as typeof ZapClient;
=======
=======
>>>>>>> parent of 2163304 (Describe what you added or fixed)
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
<<<<<<< HEAD
>>>>>>> parent of 2163304 (Describe what you added or fixed)
=======
>>>>>>> parent of 2163304 (Describe what you added or fixed)
