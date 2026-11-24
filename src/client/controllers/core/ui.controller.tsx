import { Controller, OnStart } from "@flamework/core";
import React from "@rbxts/react";
import { createPortal, createRoot } from "@rbxts/react-roblox";
import { Players } from "@rbxts/services";
import { App } from "client/ui/app";

/** Mounts the React UI into PlayerGui once. All UI lives under `client/ui`. */
@Controller()
export class UiController implements OnStart {
	public onStart(): void {
		const playerGui = Players.LocalPlayer.WaitForChild("PlayerGui");
		const root = createRoot(new Instance("Folder"));
		root.render(createPortal(<App />, playerGui));
	}
}
