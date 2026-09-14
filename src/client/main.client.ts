import { startBattlefield3d } from "client/controllers/battlefield3d";
import { startCombatController } from "client/controllers/combat";
import { startCombatHud } from "client/controllers/combatHud";
import { startReplicationController } from "client/controllers/replication";
import { startStateDebugController } from "client/controllers/stateDebug";
import { variableScheduler } from "shared/ecs/scheduler";

// Importing/retaining the variable scheduler starts Planck's RunService plugin.
// Presentation systems can be registered on its explicit phases as they land.
assert(variableScheduler !== undefined);

startStateDebugController();
startCombatHud();
startCombatController();
startBattlefield3d();
startReplicationController();
