import { createBinding } from "@rbxts/react";
import { RunService } from "@rbxts/services";

/**
 * ONE shared animation clock for all UI: a binding of seconds since the
 * client started, updated every frame by a single RenderStepped connection,
 * without re-rendering anything. Map it into props for looping animations:
 * `Rotation={clock.map((t) => t * 30)}`.
 */
const [clock, setClock] = createBinding(0);
let started = false;

export function useAnimationClock() {
	if (!started) {
		started = true;
		const start = os.clock();
		RunService.RenderStepped.Connect(() => setClock(os.clock() - start));
	}
	return clock;
}
