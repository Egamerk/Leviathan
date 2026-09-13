import { Money } from "shared/ecs/components";
import { gameBus } from "shared/ecs/bus";
import { world } from "shared/ecs/world";
import { getSession } from "server/services/profile";

function writeMoney(userId: number, guid: string, money: number): void {
	const session = getSession(userId);
	if (session === undefined || !session.profile.IsActive()) return;

	const saved = session.profile.Data.entities[guid];
	if (saved === undefined) return;

	saved.components.money = money;
	session.profile.Data.money = money;
}

/** Owns all ECS → ProfileStore writes. Gameplay systems never import ProfileStore. */
export function startPersistenceSystem(): void {
	gameBus.subscribe("MoneyChanged", ({ userId, guid, money }) => {
		writeMoney(userId, guid, money);
	});

	gameBus.subscribe("SaveRequested", ({ userId }) => {
		const session = getSession(userId);
		if (session === undefined) return;

		const money = world.get(session.dummyEntity, Money);
		if (money !== undefined) {
			writeMoney(userId, session.dummyGuid, money);
		}
	});
}
