import type { Entity } from "@rbxts/jecs";

export interface GameEvents {
	PlayerLoaded: {
		player: Player;
		userId: number;
		playerEntity: Entity;
		dummyEntity: Entity;
		guid: string;
		money: number;
	};
	MoneyChanged: {
		userId: number;
		guid: string;
		money: number;
	};
	EntitySpawned: {
		userId: number;
		guid: string;
		entity: Entity;
		kind: "dummy";
	};
	EntityDespawned: {
		userId: number;
		guid: string;
	};
	SaveRequested: {
		userId: number;
	};
}

type EventName = keyof GameEvents;
type Listener = (payload: unknown) => void;

/** Synchronous typed event bus. Systems publish facts instead of calling each other. */
class EventBus {
	private readonly listeners = new Map<EventName, Listener[]>();

	public subscribe<K extends EventName>(event: K, handler: (payload: GameEvents[K]) => void): () => void {
		const listeners = this.listeners.get(event) ?? [];
		const listener: Listener = (payload) => handler(payload as GameEvents[K]);
		listeners.push(listener);
		this.listeners.set(event, listeners);

		return () => {
			const index = listeners.indexOf(listener);
			if (index !== -1) listeners.remove(index);
		};
	}

	public publish<K extends EventName>(event: K, payload: GameEvents[K]): void {
		const listeners = this.listeners.get(event);
		if (listeners === undefined) return;

		for (const listener of [...listeners]) {
			listener(payload);
		}
	}
}

export const gameBus = new EventBus();
