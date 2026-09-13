import { subscribe } from "@rbxts/charm";
import { moneyAtom } from "shared/state/money";

/** Temporary observable proving that replicated server state reaches Charm. */
export function startStateDebugController(): void {
	subscribe(moneyAtom, (money) => {
		print(`[client] mirrored money = ${money}`);
	});
}
