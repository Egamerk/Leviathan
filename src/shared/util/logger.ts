import Log, { LogLevel } from "@rbxts/log";
import { RunService } from "@rbxts/services";

/**
 * Configures the global `@rbxts/log` logger once per runtime. Inside a
 * service, use `Log.ForContext(MyService)` (or the `Log.*` helpers) for
 * structured, tagged output instead of print/warn.
 */
export function setupLogger(): void {
	const level = RunService.IsStudio() ? LogLevel.Debugging : LogLevel.Information;
	Log.SetLogger(Log.Configure().SetMinLogLevel(level).WriteTo(Log.RobloxOutput()).Create());
}
