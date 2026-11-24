import Net from "shared/net/client";
import { assertCombatantSnapshot, assertEncounterSnapshot } from "shared/net/validators";
import { applyCombatantSnapshot } from "shared/state/combatants";
import { applyEncounterSnapshot } from "shared/state/encounter";

/** Validates server deltas at the client boundary and updates Charm mirrors. */
export function startReplicationController(): void {
	Net.replicateCombatant.setCallback((untrustedSnapshot) => {
		const snapshot = assertCombatantSnapshot(untrustedSnapshot);
		applyCombatantSnapshot(snapshot, true);
	});

	Net.replicateEncounter.setCallback((untrustedSnapshot) => {
		applyEncounterSnapshot(assertEncounterSnapshot(untrustedSnapshot));
	});

	Net.ready.fire();
}
