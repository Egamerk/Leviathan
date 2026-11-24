import { Flamework } from "@flamework/core";
import Log from "@rbxts/log";
import { setupLogger } from "shared/util/logger";

/**
 * Client entry point. Flamework discovers every `@Controller` and `@Component`
 * under these folders (recursively), resolves their dependencies, then runs
 * lifecycles in order: onInit (sync, by loadOrder) → onStart → onTick/onRender.
 */
setupLogger();

Flamework.addPathsGlob("src/client/controllers/**/*.controller.ts");
Flamework.addPathsGlob("src/client/controllers/**/*.controller.tsx");
Flamework.addPathsGlob("src/client/components/**/*.component.ts");
Flamework.addPathsGlob("src/client/components/**/*.component.tsx");
Flamework.addPathsGlob("src/shared/components/**/*.component.ts");

Flamework.ignite();
Log.Info("Client ignited");
