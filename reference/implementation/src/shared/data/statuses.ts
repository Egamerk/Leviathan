/**
 * Status effects are data + a small handler table. Add a status by adding an id
 * and a handler; the combat engine calls `onTurnStart` for the owner's turn.
 */

export type StatusId = "Bleed" | "Dazed";

export interface StatusInstance {
	id: StatusId;
	/** X in the Trello formulas. */
	potency: number;
	/** Y in the Trello formulas; turns remaining. */
	duration: number;
}

export interface StatusTickResult {
	damage: number;
	/** Display name for this tick (e.g. bleed tiers). */
	label: string;
}

interface StatusHandler {
	apply(existing: StatusInstance | undefined, potency: number, duration: number): StatusInstance;
	onTurnStart(instance: StatusInstance): StatusTickResult;
}

/** Trello: Status Effects → Bleed (Tier I Bleed, II Hemorrhage, III Exsanguination). */
const Bleed: StatusHandler = {
	apply(existing, potency, duration) {
		if (existing === undefined) return { id: "Bleed", potency, duration: math.max(duration, 1) };
		// Without an active duration, a fresh application sets 1 turn but does not stack.
		if (existing.duration <= 0) return { id: "Bleed", potency: existing.potency, duration: 1 };
		return { id: "Bleed", potency: existing.potency + potency, duration: math.max(existing.duration, duration) };
	},
	onTurnStart(instance) {
		const x = instance.potency;
		const y = instance.duration;
		let result: StatusTickResult;
		if (x >= 10) result = { damage: math.min(0.25 * x * y, 15), label: "Exsanguination" };
		else if (x >= 5) result = { damage: 0.5 * x, label: "Hemorrhage" };
		else result = { damage: 0.25 * x, label: "Bleed" };
		instance.duration -= 1;
		return result;
	},
};

const Dazed: StatusHandler = {
	apply(existing, potency, duration) {
		return { id: "Dazed", potency, duration: math.max(existing?.duration ?? 0, duration) };
	},
	onTurnStart(instance) {
		instance.duration -= 1;
		return { damage: 0, label: "Dazed" };
	},
};

export const StatusHandlers: Record<StatusId, StatusHandler> = { Bleed, Dazed };
