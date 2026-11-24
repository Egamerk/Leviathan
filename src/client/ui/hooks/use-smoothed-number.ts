import { useBinding, useEffect, useRef } from "@rbxts/react";
import { RunService } from "@rbxts/services";

/**
 * A binding that eases toward `target` each frame (exponential smoothing), so
 * bars drain/refill smoothly instead of snapping. `speed` ≈ 1 / seconds to
 * close most of the gap. Only runs while moving.
 */
export function useSmoothedNumber(target: number, speed = 6) {
	const [value, setValue] = useBinding(target);
	const current = useRef(target);

	useEffect(() => {
		if (math.abs(current.current - target) < 1e-4) return;
		const connection = RunService.RenderStepped.Connect((dt) => {
			const gap = target - current.current;
			current.current = math.abs(gap) < 1e-4 ? target : current.current + gap * math.min(dt * speed, 1);
			setValue(current.current);
			if (current.current === target) connection.Disconnect();
		});
		return () => connection.Disconnect();
	}, [target]);

	return value;
}
