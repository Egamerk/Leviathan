<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
import React from "@rbxts/react";
import { createPortal, createRoot } from "@rbxts/react-roblox";
import { Players } from "@rbxts/services";
import { startCameraController } from "client/controllers/camera";
import { startEncounterController } from "client/controllers/encounter";
import { startMovementController } from "client/controllers/movement";
import { startQteController } from "client/controllers/qte";
import { App } from "client/ui/App";

/** Client composition root: controllers own input + world presentation, React owns the HUD. */

startMovementController();
startCameraController();
startEncounterController();
startQteController();

const playerGui = Players.LocalPlayer.WaitForChild("PlayerGui");
const root = createRoot(new Instance("Folder"));
root.render(createPortal(React.createElement(App), playerGui));

print("[client] Leviathan ready");
=======
=======
>>>>>>> parent of 2163304 (Describe what you added or fixed)
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
<<<<<<< HEAD
>>>>>>> parent of 2163304 (Describe what you added or fixed)
=======
>>>>>>> parent of 2163304 (Describe what you added or fixed)
=======
>>>>>>> parent of d1073a4 (Merge pull request #1 from Egamerk/claude/dreamy-hawking-6myczo)
