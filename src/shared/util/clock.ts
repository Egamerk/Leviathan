import { Workspace } from "@rbxts/services";

/** Server-synchronised time, identical on server and clients (used for QTE windows). */
export function now(): number {
	return Workspace.GetServerTimeNow();
}
