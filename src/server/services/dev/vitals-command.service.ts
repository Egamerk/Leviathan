import { OnStart, Service } from "@flamework/core";
import { Players, RunService, TextChatService } from "@rbxts/services";
import { VitalsService } from "server/services/vitals/vitals.service";
import type { VitalName } from "shared/schemas/vitals";

const VITALS: readonly VitalName[] = ["health", "stamina", "auxiliary", "reservoir"];

/**
 * STUDIO ONLY. Chat commands for testing the HUD:
 *   /vitals health 2        set a pool
 *   /vitals stamina -1      (prefix +/- to change relative to current)
 *   /vitals full            refill everything
 */
@Service()
export class VitalsCommandService implements OnStart {
	constructor(private readonly vitals: VitalsService) {}

	public onStart(): void {
		if (!RunService.IsStudio()) return;

		const commands = TextChatService.FindFirstChild("TextChatCommands");
		if (commands === undefined) return; // legacy chat: command unavailable

		const command = new Instance("TextChatCommand");
		command.Name = "VitalsCommand";
		command.PrimaryAlias = "/vitals";
		command.Parent = commands;

		command.Triggered.Connect((source, message) => {
			const player = Players.GetPlayerByUserId(source.UserId);
			if (player === undefined) return;
			const [, name, value] = message.split(" ");

			if (name === "full") {
				this.vitals.restore(player);
				return;
			}
			const vital = VITALS.find((v) => v === name);
			const amount = value !== undefined ? tonumber(value) : undefined;
			if (vital === undefined || amount === undefined) return;

			const first = value.sub(1, 1);
			if (first === "+" || first === "-") this.vitals.change(player, { [vital]: amount });
			else this.vitals.set(player, { [vital]: amount });
		});
	}
}
