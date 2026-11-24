import type { AttackQteKind, DodgeDirection, Limb } from "shared/data/abilities";
import type { StatusInstance } from "shared/data/statuses";
import type { NodeId } from "shared/nav/grid";
import type { EncounterKind } from "shared/rules/initiative";
import type { DerivedStats, MainStats } from "shared/rules/stats";

export type Side = "diver" | "enemy";

export interface Resource {
	current: number;
	max: number;
}

export interface Combatant {
	id: string;
	name: string;
	side: Side;
	/** "player" combatants are driven by a client; everything else by AI. */
	control: "player" | "ai";
	userId?: number;
	/** Enemy definition id, or "Diver". */
	defId: string;
	stats: MainStats;
	derived: DerivedStats;
	defense: number;
	canParry: boolean;
	canDodge: boolean;
	health: Resource;
	stamina: Resource;
	reservoir?: Resource;
	auxiliary: Resource;
	node: NodeId;
	abilities: string[];
	statuses: StatusInstance[];
	condition: "active" | "unconscious" | "dead";
	/** Skips the next turn (failed parry, etc.). */
	staggered: boolean;
}

export interface TurnState {
	actorId: string;
	mainUsed: boolean;
	sideUsed: boolean;
}

/** The engine pauses on these until the server feeds back a QTE result (or a timeout). */
export type PendingStep =
	| {
			kind: "AttackQte";
			attackerId: string;
			targetId: string;
			abilityId: string;
			qte: AttackQteKind;
	  }
	| {
			kind: "Defense";
			attackerId: string;
			targetId: string;
			abilityId: string;
			damage: number;
			limb: Limb;
			canParry: boolean;
			canDodge: boolean;
	  };

export interface CombatState {
	id: string;
	kind: EncounterKind;
	round: number;
	order: string[];
	turnIndex: number;
	combatants: Map<string, Combatant>;
	turn: TurnState;
	/** Ids that get one extra consecutive turn (ambushers). Consumed when used. */
	extraTurns: string[];
	pending?: PendingStep;
	outcome?: Side;
}

// ── Commands (input) ────────────────────────────────────────────────────────

export type CombatCommand =
	| { type: "Move"; actorId: string; to: NodeId }
	| { type: "UseAbility"; actorId: string; abilityId: string; targetId: string }
	| { type: "Recover"; actorId: string }
	| { type: "EndTurn"; actorId: string }
	| { type: "ResolveAttackQte"; actorId: string; success: boolean; limb: Limb }
	| { type: "ResolveDefense"; targetId: string; reaction: "None" | "Parry" | "Dodge"; direction?: DodgeDirection };

// ── Events (output) ─────────────────────────────────────────────────────────
// Facts the presentation layer animates. Replicated to clients in order.

export type CombatEvent =
	| { type: "RoundStarted"; round: number; order: string[] }
	| { type: "TurnStarted"; actorId: string; round: number }
	| { type: "TurnSkipped"; actorId: string; reason: "Staggered" | "Down" }
	| { type: "StatusTicked"; targetId: string; label: string; damage: number }
	| { type: "Moved"; actorId: string; path: NodeId[]; cost: number; auto: boolean }
	| { type: "AbilityStarted"; actorId: string; targetId: string; abilityId: string }
	| { type: "AwaitAttackQte"; actorId: string; abilityId: string; qte: AttackQteKind }
	| {
			type: "AwaitDefense";
			targetId: string;
			attackerId: string;
			abilityId: string;
			canParry: boolean;
			canDodge: boolean;
	  }
	| { type: "Parried"; targetId: string; outcome: "Parried" | "Shattered" | "ShatteredStagger" }
	| { type: "Dodged"; targetId: string }
	| { type: "Damaged"; targetId: string; amount: number; limb: Limb; health: number }
	| { type: "StatusApplied"; targetId: string; status: string; potency: number; duration: number }
	| { type: "Recovered"; actorId: string; health: number; stamina: number; reservoir?: number }
	| { type: "ResourcesChanged"; actorId: string; stamina: number; reservoir?: number; auxiliary: number }
	| { type: "Downed"; targetId: string; condition: "unconscious" | "dead" }
	| { type: "TurnEnded"; actorId: string }
	| { type: "EncounterEnded"; winner: Side };

export type CommandResult = { ok: true; events: CombatEvent[] } | { ok: false; error: string };
