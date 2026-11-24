import { subscribe } from "@rbxts/charm";
import { useEffect, useState } from "@rbxts/react";

/** Subscribes a component to a Charm atom/getter. */
export function useAtom<T>(getter: () => T): T {
	const [value, setValue] = useState<{ current: T }>(() => ({ current: getter() }));
	useEffect(() => {
		setValue({ current: getter() });
		return subscribe(getter, (current) => setValue({ current }));
	}, [getter]);
	return value.current;
}
