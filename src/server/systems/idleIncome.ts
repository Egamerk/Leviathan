import type { World } from "@rbxts/jecs";
import { Dummy, Guid, Money, OwnerUserId } from "shared/ecs/components";
import { gameBus } from "shared/ecs/bus";
import { FIXED_STEP } from "shared/ecs/scheduler";

const INCOME_INTERVAL = 5;
const elapsedByGuid = new Map<string, number>();

export function startIdleIncomeSystem(): void {
	gameBus.subscribe("EntityDespawned", ({ guid }) => {
		elapsedByGuid.delete(guid);
	});
}

/** Fixed-step example gameplay system. It only mutates ECS and publishes facts. */
export function idleIncomeSystem(world: World): void {
	for (const [entity, guid, ownerUserId, money] of world.query(Guid, OwnerUserId, Money).with(Dummy)) {
		const elapsed = (elapsedByGuid.get(guid) ?? 0) + FIXED_STEP;
		if (elapsed < INCOME_INTERVAL) {
			elapsedByGuid.set(guid, elapsed);
			continue;
		}

		elapsedByGuid.set(guid, elapsed - INCOME_INTERVAL);
		const nextMoney = money + 1;
		world.set(entity, Money, nextMoney);
		gameBus.publish("MoneyChanged", {
			userId: ownerUserId,
			guid,
			money: nextMoney,
		});
	}
}
