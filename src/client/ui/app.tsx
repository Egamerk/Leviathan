import React from "@rbxts/react";

/**
 * Root of the React tree. Add each screen (HUD, menus, combat UI…) from
 * `ui/screens/` here; reusable pieces go in `ui/components/`.
 */
export function App() {
	return <screengui key="Leviathan" ResetOnSpawn={false} IgnoreGuiInset={true} ZIndexBehavior="Sibling" />;
}
