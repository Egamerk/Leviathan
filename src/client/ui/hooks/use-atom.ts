import { subscribe } from "@rbxts/charm";
import { useEffect, useState } from "@rbxts/react";

/**
 * Subscribes a component to a Charm atom or any getter built from atoms
 * (e.g. `() => playerDataAtom()?.schemaVersion`).
 */
export function useAtom<T>(getter: () => T): T {
	// Box the value so function-typed state isn't mistaken for an updater.
	const [state, setState] = useState(() => ({ value: getter() }));
	useEffect(() => {
		setState({ value: getter() });
		return subscribe(getter, (value) => setState({ value }));
	}, [getter]);
	return state.value;
}
