import { Flamework } from "@flamework/core";
import Log from "@rbxts/log";
import { setupLogger } from "shared/util/logger";

/**
 * Client entry point. Flamework discovers every `@Controller` and `@Component`
 * matching the globs below, resolves their dependencies, then runs lifecycles
 * in order: onInit (sync, by loadOrder) → onStart → onTick/onRender.
 */
setupLogger();

// Loading controllers can wait on the server (e.g. network remotes). If that
// never finishes, say so instead of silently showing no UI.
let ignited = false;
task.delay(10, () => {
	if (!ignited) {
		warn(
			"[Leviathan] Client still starting after 10s. The server probably failed to start: " +
				"check Output for server errors (look for 'Server ignited').",
		);
	}
});

Flamework.addPathsGlob("src/client/controllers/**/*.controller.ts");
Flamework.addPathsGlob("src/client/controllers/**/*.controller.tsx");
Flamework.addPathsGlob("src/client/components/**/*.component.ts");
Flamework.addPathsGlob("src/client/components/**/*.component.tsx");
Flamework.addPathsGlob("src/shared/components/**/*.component.ts");

Flamework.ignite();
ignited = true;
Log.Info("Client ignited");
