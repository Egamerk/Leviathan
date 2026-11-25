import Log from "@rbxts/log";
import { Players, RunService, TextChatService } from "@rbxts/services";

/**
 * Registers a STUDIO-ONLY chat command (e.g. "/vitals"). Commands live in
 * our own folder directly under TextChatService, so they don't depend on
 * Roblox's default TextChatCommands folder, which is created at runtime and
 * may not exist yet when services start.
 *
 * `handler` gets the player and the words after the alias.
 */
export function registerDevCommand(alias: string, handler: (player: Player, args: string[]) => void): void {
	if (!RunService.IsStudio()) return;
	if (TextChatService.ChatVersion !== Enum.ChatVersion.TextChatService) {
		Log.Warn("Dev command {Alias} unavailable: the place uses legacy chat", alias);
		return;
	}

	let folder = TextChatService.FindFirstChild("DevCommands");
	if (folder === undefined) {
		folder = new Instance("Folder");
		folder.Name = "DevCommands";
		folder.Parent = TextChatService;
	}

	const command = new Instance("TextChatCommand");
	command.Name = alias.sub(2);
	command.PrimaryAlias = alias;
	command.Parent = folder;

	command.Triggered.Connect((source, message) => {
		const player = Players.GetPlayerByUserId(source.UserId);
		if (player === undefined) return;
		const words = message.split(" ").filter((word) => word !== "");
		Log.Info("{Player} ran {Message}", player.Name, message);
		handler(
			player,
			words.filter((_, index) => index > 0),
		);
	});
	Log.Info("Dev command {Alias} registered", alias);
}
