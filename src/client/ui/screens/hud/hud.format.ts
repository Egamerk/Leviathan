/** HUD elements with a hover zone. */
export type HudElement = "oxygen" | "health" | "auxiliary" | "stamina" | "reservoir";

/** "3", "3.5", never "3.50" or "3.0". */
export function formatValue(value: number): string {
	const rounded = math.round(value * 10) / 10;
	return rounded % 1 === 0 ? tostring(rounded) : string.format("%.1f", rounded);
}
