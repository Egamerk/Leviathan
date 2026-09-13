import { HttpService } from "@rbxts/services";

/** Generates a stable save identifier independent of jecs entity ids. */
export function createGuid(): string {
	return HttpService.GenerateGUID(false);
}
