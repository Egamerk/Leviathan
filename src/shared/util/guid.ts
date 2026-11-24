import { HttpService } from "@rbxts/services";

<<<<<<< HEAD
export function guid(): string {
=======
/** Generates a stable save identifier independent of jecs entity ids. */
export function createGuid(): string {
>>>>>>> parent of 2163304 (Describe what you added or fixed)
	return HttpService.GenerateGUID(false);
}
