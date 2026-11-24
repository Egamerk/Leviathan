import { RunService } from "@rbxts/services";
import { startEnemyService } from "server/ai/enemyService";
import { startLightTracking } from "server/ai/lighting";
import { runSelfTests } from "server/dev/selfTest";
import { startSandbox } from "server/dev/sandbox";
import { onDiverLeaving, startEncounter, startEncounterService } from "server/encounter/encounterService";
import { startNavService } from "server/services/nav";
import { startPlayersService } from "server/services/players";

/**
 * Composition root. Services expose plain `start*` functions and receive their
 * collaborators as callbacks, so the dependency graph is visible right here:
 *
 *   players ─► encounter (leave)      enemies ─► encounter (engage)
 *   enemies ─► nav (pathing)          encounter ─► nav (arena snapshot)
 */

if (RunService.IsStudio()) runSelfTests();

startLightTracking();
startNavService();
startPlayersService(onDiverLeaving);
startEncounterService();
startEnemyService(startEncounter);
startSandbox();

print("[server] Leviathan ready");
