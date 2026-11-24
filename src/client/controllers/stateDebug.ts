import { subscribe } from "@rbxts/charm";
import { ContextActionService, ReplicatedStorage, RunService } from "@rbxts/services";
import { combatantAtom } from "shared/state/combat";
import { evadeWindowAtom } from "shared/state/evade";

const PERSIST_RELOAD_REMOTE = "PersistReload";

function bindStudioPersistReload(): void {
	if (!RunService.IsStudio()) return;

	ContextActionService.BindAction(
		"StudioPersistReload",
		(_, state) => {
			if (state !== Enum.UserInputState.Begin) return Enum.ContextActionResult.Pass;
			const remote = ReplicatedStorage.FindFirstChild(PERSIST_RELOAD_REMOTE) as RemoteEvent | undefined;
			if (remote !== undefined) {
				remote.FireServer();
				print(`[client] persist soft-reload requested`);
			}
			return Enum.ContextActionResult.Sink;
		},
		false,
		Enum.KeyCode.P,
	);
}

/** Temporary observable proving that replicated server state reaches Charm. */
export function startStateDebugController(): void {
	subscribe(combatantAtom, (state) => {
		if (state === undefined) return;
		print(
			`[client] HP ${state.health.current}/${state.health.max} | stamina ${state.stamina.current}/${state.stamina.max} | initiative ${state.initiative}`,
		);
	});
	subscribe(evadeWindowAtom, (window) => {
		if (window !== undefined) {
			print(`[client] ${window.reaction} window ${window.windowId}`);
		}
	});
	bindStudioPersistReload();
}

