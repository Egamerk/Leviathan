import Log from "@rbxts/log";
import { Players, RunService, TextChatService } from "@rbxts/services";

type Handler = (player: Player, args: string[]) => void;

/**
 * STUDIO-ONLY chat commands (e.g. "/vitals stamina 2").
 *
 * Two independent routes, so a command works regardless of chat setup:
 *  1. A TextChatCommand under TextChatService. When Roblox matches it, the
 *     message is swallowed (not shown in chat).
 *  2. Player.Chatted on the server, which fires for any message that was
 *     actually sent (new and legacy chat). If route 1 handled the message it
 *     was never sent, so a command can't run twice.
 */
const handlers = new Map<string, Handler>();
let chattedHooked = false;

function run(player: Player, message: string, via: string): boolean {
	const words = message.split(" ").filter((word) => word !== "");
	const alias = words[0]?.lower();
	const handler = alias !== undefined ? handlers.get(alias) : undefined;
	if (handler === undefined) return false;
	Log.Info("{Player} ran {Message} (via {Route})", player.Name, message, via);
	handler(
		player,
		words.filter((_, index) => index > 0),
	);
	return true;
}

function hookChatted() {
	if (chattedHooked) return;
	chattedHooked = true;
	const hook = (player: Player) => player.Chatted.Connect((message) => run(player, message, "Chatted"));
	Players.PlayerAdded.Connect(hook);
	for (const player of Players.GetPlayers()) hook(player);
}

function addTextChatCommand(alias: string) {
	if (TextChatService.ChatVersion !== Enum.ChatVersion.TextChatService) return;
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
		if (player !== undefined) run(player, message, "TextChatCommand");
	});
}

export function registerDevCommand(alias: string, handler: Handler): void {
	if (!RunService.IsStudio()) return;
	handlers.set(alias.lower(), handler);
	hookChatted();
	addTextChatCommand(alias);
	Log.Info("Dev command {Alias} registered", alias);
}
