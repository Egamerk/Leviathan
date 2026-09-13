import { ReplicatedStorage } from "@rbxts/services";
import type { PlayerDelta } from "./types";

interface ClientNetwork {
	sendEvents: () => void;
	replicatePlayer: {
		setCallback: (callback: (value: PlayerDelta) => void) => () => void;
	};
	ready: {
		fire: () => void;
	};
	getPing: {
		call: () => number;
	};
}

const networkFolder = ReplicatedStorage.WaitForChild("Network");
const network = require(networkFolder.WaitForChild("Client") as ModuleScript) as ClientNetwork;

export default network;
