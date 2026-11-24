import { HttpService } from "@rbxts/services";

export function guid(): string {
	return HttpService.GenerateGUID(false);
}
