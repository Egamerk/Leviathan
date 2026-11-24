import { Flamework } from "@flamework/core";
import Log from "@rbxts/log";
import { setupLogger } from "shared/util/logger";

/**
 * Server entry point. Flamework discovers every `@Service` and `@Component`
 * under these folders (recursively), resolves their dependencies, then runs
 * lifecycles in order: onInit (sync, by loadOrder) → onStart → onTick/etc.
 */
setupLogger();

Flamework.addPathsGlob("src/server/services/**/*.service.ts");
Flamework.addPathsGlob("src/server/components/**/*.component.ts");
Flamework.addPathsGlob("src/shared/components/**/*.component.ts");

Flamework.ignite();
Log.Info("Server ignited");
