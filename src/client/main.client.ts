import { variableScheduler } from "shared/ecs/scheduler";
import { startReplicationController } from "client/controllers/replication";
import { startStateDebugController } from "client/controllers/stateDebug";

// Importing/retaining the variable scheduler starts Planck's RunService plugin.
// Presentation systems can be registered on its explicit phases as they land.
assert(variableScheduler !== undefined);

startStateDebugController();
startReplicationController();
