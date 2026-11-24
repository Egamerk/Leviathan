import { useBinding, useEffect } from "@rbxts/react";
import { RunService } from "@rbxts/services";

/**
 * A binding of seconds elapsed since mount, updated every frame WITHOUT
 * re-rendering. Map it into props for looping animations:
 * `Rotation={clock.map((t) => t * 30)}`.
 */
export function useAnimationClock() {
	const [clock, setClock] = useBinding(0);
	useEffect(() => {
		const start = os.clock();
		const connection = RunService.RenderStepped.Connect(() => setClock(os.clock() - start));
		return () => connection.Disconnect();
	}, []);
	return clock;
}
