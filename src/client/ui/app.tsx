import React from "@rbxts/react";
import { Hud } from "./screens/hud/hud";

/**
 * Root of the React tree. Each screen in `ui/screens/` renders its own
 * ScreenGui (so each can choose its inset, display order and reset rules).
 */
export function App() {
	return (
		<>
			<Hud />
		</>
	);
}
