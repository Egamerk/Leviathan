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
