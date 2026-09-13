import { Players } from "@rbxts/services";
import { fixedScheduler, startFixedStep, variableScheduler } from "shared/ecs/scheduler";
import { startPlayersService } from "server/services/players";
import { idleIncomeSystem, startIdleIncomeSystem } from "server/systems/idleIncome";
import { startPersistenceSystem } from "server/systems/persistence";
import { startReplicationSystem } from "server/systems/replication";

// Subscribers must exist before player profiles publish lifecycle events.
startPersistenceSystem();
startReplicationSystem();
startIdleIncomeSystem();

fixedScheduler.addSystem(idleIncomeSystem);
startFixedStep();

// Retain the variable scheduler for future presentation/non-deterministic work.
assert(variableScheduler !== undefined);
startPlayersService();

print(`[server] Leviathan ready (${Players.GetPlayers().size()} player(s) already in game)`);
