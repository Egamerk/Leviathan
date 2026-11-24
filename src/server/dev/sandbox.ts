import { CollectionService, RunService } from "@rbxts/services";
import { ENEMY_SPAWN_TAG, spawnEnemy } from "server/ai/enemyService";

/**
 * Studio-only: if the place has no `EnemySpawn` parts yet, drop a couple of test
 * enemies on the baseplate so detection → pursuit → encounter can be played
 * immediately after `rojo serve`.
 */
export function startSandbox() {
	if (!RunService.IsStudio()) return;
	if (CollectionService.GetTagged(ENEMY_SPAWN_TAG).size() > 0) return;
	spawnEnemy("Drifter", new Vector3(40, 0, 40));
	spawnEnemy("SeaScorn", new Vector3(-45, 0, 35));
	print("[sandbox] Spawned test enemies (add EnemySpawn-tagged parts to disable)");
}
