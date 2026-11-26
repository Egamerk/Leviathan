import { OnStart, Service } from "@flamework/core";
import Log from "@rbxts/log";
import { Workspace } from "@rbxts/services";
import { LightingOverrideAttribute, LightingPresets } from "shared/config/lighting";
import { registerDevCommand } from "./dev-commands";

/**
 * STUDIO ONLY. Force a lighting preset for everyone (sets a Workspace
 * attribute, which replicates):
 *   /lighting cathedral     force a preset (case-insensitive)
 *   /lighting off           back to zones
 */
@Service()
export class LightingCommandService implements OnStart {
	public onStart(): void {
		registerDevCommand("/lighting", (_, [name]) => {
			const names = new Array<string>();
			for (const [key] of pairs(LightingPresets)) names.push(key);
			if (name === undefined || name.lower() === "off") {
				Workspace.SetAttribute(LightingOverrideAttribute, undefined);
				Log.Info("Lighting: back to zones");
				return;
			}
			const match = names.find((n) => n.lower() === name.lower());
			if (match === undefined) {
				Log.Warn("Usage: /lighting <{Presets}|off>", names.join("|"));
				return;
			}
			Workspace.SetAttribute(LightingOverrideAttribute, match);
		});
	}
}
