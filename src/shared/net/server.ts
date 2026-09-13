import { ReplicatedStorage } from "@rbxts/services";
import type { PlayerDelta } from "./types";

interface ServerNetwork {
	sendEvents: () => void;
	replicatePlayer: {
		fire: (player: Player, value: PlayerDelta) => void;
	};
	ready: {
		setCallback: (callback: (player: Player) => void) => () => void;
	};
	getPing: {
		setCallback: (callback: (player: Player) => number) => () => void;
	};
}

const networkFolder = ReplicatedStorage.WaitForChild("Network");
const network = require(networkFolder.WaitForChild("Server") as ModuleScript) as ServerNetwork;

export default network;
