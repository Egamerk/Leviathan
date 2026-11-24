<<<<<<< HEAD
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
=======
import { Players } from "@rbxts/services";
import { FixedPhases, fixedScheduler, startFixedStep, variableScheduler } from "shared/ecs/scheduler";
import { startPlayersService } from "server/services/players";
import { startPersistenceSystem } from "server/systems/persistence";
import { startReplicationSystem } from "server/systems/replication";
import {
	combatCleanupSystem,
	combatEffectsSystem,
	combatInputSystem,
	evadeResolveSystem,
	startCombatSystems,
	turnResolveSystem,
} from "server/systems/combat";

// Subscribers must exist before player profiles publish lifecycle events.
startPersistenceSystem();
startReplicationSystem();
startCombatSystems();

fixedScheduler.addSystem(combatInputSystem, FixedPhases.Input);
fixedScheduler.addSystem(turnResolveSystem, FixedPhases.Resolve);
fixedScheduler.addSystem(evadeResolveSystem, FixedPhases.Resolve);
fixedScheduler.addSystem(combatEffectsSystem, FixedPhases.Effects);
fixedScheduler.addSystem(combatCleanupSystem, FixedPhases.Cleanup);

startFixedStep();

// Retain the variable scheduler for future presentation/non-deterministic work.
assert(variableScheduler !== undefined);
startPlayersService();

print(`[server] Leviathan ready (${Players.GetPlayers().size()} player(s) already in game)`);
>>>>>>> parent of 2163304 (Describe what you added or fixed)
