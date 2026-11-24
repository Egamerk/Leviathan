// Create Zap's remotes before anything else. Clients wait for them when their
// network module loads, so if the server never got this far, every client
// would hang during startup with no UI and no error.
import "server/network";

import { Flamework } from "@flamework/core";
import Log from "@rbxts/log";
import { setupLogger } from "shared/util/logger";

/**
 * Server entry point. Flamework discovers every `@Service` and `@Component`
 * matching the globs below, resolves their dependencies, then runs lifecycles
 * in order: onInit (sync, by loadOrder) → onStart → onTick/etc.
 */
setupLogger();

Flamework.addPathsGlob("src/server/services/**/*.service.ts");
Flamework.addPathsGlob("src/server/components/**/*.component.ts");
Flamework.addPathsGlob("src/shared/components/**/*.component.ts");

Flamework.ignite();
Log.Info("Server ignited");
