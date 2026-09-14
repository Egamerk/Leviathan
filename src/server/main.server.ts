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
