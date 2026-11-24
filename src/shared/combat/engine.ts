import { CombatConfig } from "shared/config";
import { type AbilityDef, getAbility, type Limb, SCALING_UNIT } from "shared/data/abilities";
import { StatusHandlers } from "shared/data/statuses";
import type { NodeId, VoxelGrid } from "shared/nav/grid";
import { findPath, pathFromReachable, reachable, type ReachableSet } from "shared/nav/pathfinder";
import { applyDefense, enemyDodgeChance, enemyParryChance, isImplosion, resolveParry } from "shared/rules/damage";
import { baseInitiative, buildTurnOrder, type EncounterKind } from "shared/rules/initiative";
import type { Combatant, CombatCommand, CombatEvent, CombatState, CommandResult, Side } from "./types";

/**
 * The turn-based combat rules as a deterministic state machine.
 *
 *     command ──► validate ──► mutate state ──► CombatEvent[]
 *
 * It knows nothing about Players, networking, animation or time. The server's
 * EncounterService owns one engine per fight, feeds it validated commands
 * (from clients, the AI, or QTE timeouts) and replicates the events. Keeping the
 * rules here means they can be unit tested and reasoned about in isolation.
 */

export class CombatEngine {
	public readonly state: CombatState;
	private events = new Array<CombatEvent>();

	public constructor(
		id: string,
		kind: EncounterKind,
		combatants: Combatant[],
		public readonly grid: VoxelGrid,
		private readonly rng: Random,
		initiatorId?: string,
	) {
		const map = new Map<string, Combatant>();
		for (const combatant of combatants) map.set(combatant.id, combatant);

		const { order, extraTurns } = buildTurnOrder(
			combatants.map((c) => ({ id: c.id, side: c.side, initiative: this.initiativeOf(c) })),
			kind,
			initiatorId,
		);

		this.state = {
			id,
			kind,
			round: 1,
			order,
			turnIndex: 0,
			combatants: map,
			turn: { actorId: order[0], mainUsed: false, sideUsed: false },
			extraTurns,
		};
		this.syncBlocked();
	}

	// ── Public API ──────────────────────────────────────────────────────────

	/** Emits round 1 and the first turn. Call once after construction. */
	public start(): CombatEvent[] {
		this.emit({ type: "RoundStarted", round: 1, order: [...this.state.order] });
		this.beginTurn();
		return this.flush();
	}

	public apply(command: CombatCommand): CommandResult {
		if (this.state.outcome !== undefined) return { ok: false, error: "Encounter is over" };

		const failure = this.dispatch(command);
		if (failure !== undefined) {
			this.events.clear();
			return { ok: false, error: failure };
		}
		return { ok: true, events: this.flush() };
	}

	/** A combatant leaves the fight (player disconnected, fled…). */
	public forfeit(id: string): CombatEvent[] {
		const combatant = this.get(id);
		if (combatant === undefined || combatant.condition === "dead" || this.state.outcome !== undefined) return [];
		combatant.condition = "dead";
		this.grid.unblock(combatant.node);
		const pending = this.state.pending;
		if (pending !== undefined && (pending.attackerId === id || pending.targetId === id))
			this.state.pending = undefined;
		this.emit({ type: "Downed", targetId: id, condition: "dead" });
		this.checkOutcome();
		if (this.state.outcome === undefined && this.state.turn.actorId === id) this.advance();
		return this.flush();
	}

	public get(id: string): Combatant | undefined {
		return this.state.combatants.get(id);
	}

	public currentActor(): Combatant {
		return this.state.combatants.get(this.state.turn.actorId)!;
	}

	/** Movement range for the overlay / AI. Other combatants block tiles. */
	public movementRange(actorId: string): ReachableSet | undefined {
		const actor = this.get(actorId);
		if (actor === undefined) return undefined;
		this.grid.unblock(actor.node);
		const set = reachable(this.grid, actor.node, actor.derived.moveStuds);
		this.grid.block(actor.node);
		return set;
	}

	public distance(a: Combatant, b: Combatant): number {
		return this.grid.nodePosition(a.node).sub(this.grid.nodePosition(b.node)).Magnitude;
	}

	public isTooCloseToOpponent(actor: Combatant, node: NodeId): boolean {
		const position = this.grid.nodePosition(node);
		for (const [, other] of this.state.combatants) {
			if (other.side === actor.side || other.condition !== "active") continue;
			if (this.grid.nodePosition(other.node).sub(position).Magnitude < CombatConfig.personalSpace) return true;
		}
		return false;
	}

	// ── Dispatch ────────────────────────────────────────────────────────────

	private dispatch(command: CombatCommand): string | undefined {
		const pending = this.state.pending;
		if (pending !== undefined) {
			if (command.type === "ResolveAttackQte" && pending.kind === "AttackQte") return this.onAttackQte(command);
			if (command.type === "ResolveDefense" && pending.kind === "Defense") return this.onDefense(command);
			return "Waiting for a reaction";
		}

		switch (command.type) {
			case "Move":
				return this.onMove(command.actorId, command.to);
			case "UseAbility":
				return this.onUseAbility(command.actorId, command.abilityId, command.targetId);
			case "Recover":
				return this.onRecover(command.actorId);
			case "EndTurn":
				return this.onEndTurn(command.actorId);
			default:
				return "Nothing to resolve";
		}
	}

	private requireActor(actorId: string): Combatant | string {
		if (this.state.turn.actorId !== actorId) return "Not your turn";
		const actor = this.get(actorId);
		if (actor === undefined || actor.condition !== "active") return "Actor cannot act";
		return actor;
	}

	// ── Side action: Move ───────────────────────────────────────────────────

	private onMove(actorId: string, to: NodeId): string | undefined {
		const actor = this.requireActor(actorId);
		if (typeIs(actor, "string")) return actor;
		if (this.state.turn.sideUsed) return "Side action already used";
		if (this.isTooCloseToOpponent(actor, to)) return "Too close to an enemy";

		const range = this.movementRange(actorId)!;
		const path = pathFromReachable(range, to);
		if (path === undefined || path.size() < 2) return "Destination out of range";

		this.state.turn.sideUsed = true;
		this.relocate(actor, to);
		this.emit({ type: "Moved", actorId, path, cost: range.cost.get(to)!, auto: false });
		return undefined;
	}

	// ── Main action: Ability ────────────────────────────────────────────────

	private onUseAbility(actorId: string, abilityId: string, targetId: string): string | undefined {
		const actor = this.requireActor(actorId);
		if (typeIs(actor, "string")) return actor;
		const ability = getAbility(abilityId);
		if (ability === undefined || !actor.abilities.includes(abilityId)) return "Unknown ability";
		if (ability.slot === "main" && this.state.turn.mainUsed) return "Main action already used";
		if (ability.slot === "side" && this.state.turn.sideUsed) return "Side action already used";

		const target = this.get(targetId);
		if (target === undefined || target.condition !== "active") return "Invalid target";
		if (target.side === actor.side) return "Cannot target an ally";

		const costError = this.checkCost(actor, ability);
		if (costError !== undefined) return costError;

		// Trello: melee attacks auto-step closer (limited) without spending the Move action.
		if (this.distance(actor, target) > ability.range) {
			if (!this.autoStep(actor, target, ability)) return "Target out of range";
		}

		this.payCost(actor, ability);
		if (ability.slot === "main") this.state.turn.mainUsed = true;
		else this.state.turn.sideUsed = true;

		this.emit({ type: "AbilityStarted", actorId, targetId, abilityId });

		if (actor.control === "player" && ability.attackQte !== undefined) {
			this.state.pending = {
				kind: "AttackQte",
				attackerId: actorId,
				targetId,
				abilityId,
				qte: ability.attackQte,
			};
			this.emit({ type: "AwaitAttackQte", actorId, abilityId, qte: ability.attackQte });
			return undefined;
		}

		this.beginDefense(actor, target, ability, 1, "Torso");
		return undefined;
	}

	private autoStep(actor: Combatant, target: Combatant, ability: AbilityDef): boolean {
		const budget = ability.autoStep ?? 0;
		if (budget <= 0) return false;
		this.grid.unblock(actor.node);
		const path = findPath(this.grid, actor.node, target.node, {
			maxCost: budget + ability.range,
			allowPartial: true,
		});
		this.grid.block(actor.node);
		if (path === undefined) return false;

		// Walk the path until we're in range, never spending more than the auto-step budget.
		const targetPosition = this.grid.nodePosition(target.node);
		let spent = 0;
		for (let i = 1; i < path.nodes.size(); i++) {
			const node = path.nodes[i];
			spent += this.grid.nodePosition(node).sub(this.grid.nodePosition(path.nodes[i - 1])).Magnitude;
			if (spent > budget + 1e-3) return false;
			if (this.grid.isBlocked(node)) return false;
			if (this.grid.nodePosition(node).sub(targetPosition).Magnitude <= ability.range) {
				const steps = new Array<NodeId>();
				for (let j = 0; j <= i; j++) steps.push(path.nodes[j]);
				this.relocate(actor, node);
				this.emit({ type: "Moved", actorId: actor.id, path: steps, cost: spent, auto: true });
				return true;
			}
		}
		return false;
	}

	private onAttackQte(command: Extract<CombatCommand, { type: "ResolveAttackQte" }>): string | undefined {
		const pending = this.state.pending;
		if (pending === undefined || pending.kind !== "AttackQte") return "No attack QTE pending";
		if (command.actorId !== pending.attackerId) return "Not your QTE";
		const ability = getAbility(pending.abilityId)!;
		const attacker = this.get(pending.attackerId)!;
		const target = this.get(pending.targetId)!;
		this.state.pending = undefined;

		const multiplier = command.success ? 1 : (ability.qteFailMultiplier ?? 0.5);
		this.beginDefense(attacker, target, ability, multiplier, command.limb);
		return undefined;
	}

	/** Players get a parry/dodge QTE; AI defenders roll against their attributes. */
	private beginDefense(attacker: Combatant, target: Combatant, ability: AbilityDef, multiplier: number, limb: Limb) {
		const damage = this.rawDamage(attacker, ability) * multiplier;
		const canParry = ability.parry !== undefined && target.canParry;
		const canDodge = ability.dodge !== undefined && target.canDodge;

		if (target.control === "player" && (canParry || canDodge)) {
			this.state.pending = {
				kind: "Defense",
				attackerId: attacker.id,
				targetId: target.id,
				abilityId: ability.id,
				damage,
				limb,
				canParry,
				canDodge,
			};
			this.emit({
				type: "AwaitDefense",
				targetId: target.id,
				attackerId: attacker.id,
				abilityId: ability.id,
				canParry,
				canDodge,
			});
			return;
		}

		// AI defense rolls (Trello: Enemy Attributes → Strength / Dexterity).
		if (canDodge && this.rng.NextNumber() < enemyDodgeChance(target.stats.dexterity, attacker.stats.dexterity)) {
			this.emit({ type: "Dodged", targetId: target.id });
			return;
		}
		if (canParry && this.rng.NextNumber() < enemyParryChance(target.stats.strength, attacker.stats.strength)) {
			this.emit({ type: "Parried", targetId: target.id, outcome: "Parried" });
			return;
		}
		this.applyHit(attacker, target, ability, damage, limb);
	}

	private onDefense(command: Extract<CombatCommand, { type: "ResolveDefense" }>): string | undefined {
		const pending = this.state.pending;
		if (pending === undefined || pending.kind !== "Defense") return "No defense pending";
		if (command.targetId !== pending.targetId) return "Not your defense";
		const ability = getAbility(pending.abilityId)!;
		const attacker = this.get(pending.attackerId)!;
		const target = this.get(pending.targetId)!;
		this.state.pending = undefined;

		if (command.reaction === "Dodge" && pending.canDodge) {
			if (command.direction !== undefined && ability.dodge!.includes(command.direction)) {
				this.emit({ type: "Dodged", targetId: target.id });
				return undefined;
			}
			// Wrong direction: the dodge whiffs and the hit lands normally.
		}

		if (command.reaction === "Parry" && pending.canParry) {
			const outcome = resolveParry(
				target.derived.parryStrength,
				ability.parry!.requiredStrength,
				ability.parry!.alwaysParryable === true,
			);
			this.emit({ type: "Parried", targetId: target.id, outcome });
			if (outcome === "Parried") return undefined;
			if (outcome === "ShatteredStagger") target.staggered = true;
		}

		this.applyHit(attacker, target, ability, pending.damage, pending.limb);
		return undefined;
	}

	private applyHit(attacker: Combatant, target: Combatant, ability: AbilityDef, raw: number, limb: Limb) {
		const amount = applyDefense(raw, target.defense, ability.armorPierce ?? 0);
		this.damage(target, amount, limb);
		if (target.condition !== "active") return;

		for (const application of ability.applies ?? []) {
			const handler = StatusHandlers[application.status];
			const index = target.statuses.findIndex((s) => s.id === application.status);
			const existing = index >= 0 ? target.statuses[index] : undefined;
			const updated = handler.apply(existing, application.potency, application.duration);
			if (index >= 0) target.statuses[index] = updated;
			else target.statuses.push(updated);
			this.emit({
				type: "StatusApplied",
				targetId: target.id,
				status: updated.id,
				potency: updated.potency,
				duration: updated.duration,
			});
		}
	}

	// ── Main action: Recover ────────────────────────────────────────────────

	private onRecover(actorId: string): string | undefined {
		const actor = this.requireActor(actorId);
		if (typeIs(actor, "string")) return actor;
		if (this.state.turn.mainUsed) return "Main action already used";
		this.state.turn.mainUsed = true;

		actor.stamina.current = math.min(actor.stamina.max, actor.stamina.current + CombatConfig.recoverStamina);
		actor.health.current = math.min(actor.health.max, actor.health.current + CombatConfig.recoverHealth);
		if (actor.reservoir !== undefined) {
			actor.reservoir.current = math.min(
				actor.reservoir.max,
				actor.reservoir.current + CombatConfig.recoverReservoir,
			);
		}
		this.emit({
			type: "Recovered",
			actorId,
			health: actor.health.current,
			stamina: actor.stamina.current,
			reservoir: actor.reservoir?.current,
		});
		return undefined;
	}

	// ── Turn flow ───────────────────────────────────────────────────────────

	private onEndTurn(actorId: string): string | undefined {
		if (this.state.turn.actorId !== actorId) return "Not your turn";
		this.emit({ type: "TurnEnded", actorId });
		this.advance();
		return undefined;
	}

	private advance() {
		// Guard: at most one full lap of skips before giving up (everyone down is caught by checkOutcome).
		for (let guard = 0; guard <= this.state.order.size() * 2; guard++) {
			if (this.state.outcome !== undefined) return;

			const current = this.state.turn.actorId;
			const extraIndex = this.state.extraTurns.indexOf(current);
			if (extraIndex >= 0) {
				this.state.extraTurns.remove(extraIndex);
			} else {
				this.state.turnIndex += 1;
				if (this.state.turnIndex >= this.state.order.size()) this.newRound();
			}
			this.state.turn = { actorId: this.state.order[this.state.turnIndex], mainUsed: false, sideUsed: false };
			if (this.beginTurn()) return;
		}
	}

	/** Trello: initiative depends on current health, so the order is rebuilt every round. */
	private newRound() {
		this.state.round += 1;
		this.state.turnIndex = 0;
		const living = new Array<Combatant>();
		for (const [, c] of this.state.combatants) if (c.condition !== "dead") living.push(c);
		this.state.order = buildTurnOrder(
			living.map((c) => ({ id: c.id, side: c.side, initiative: this.initiativeOf(c) })),
			"HeadOn",
		).order;
		this.emit({ type: "RoundStarted", round: this.state.round, order: [...this.state.order] });
	}

	/** Returns false if the turn was skipped and the engine should advance again. */
	private beginTurn(): boolean {
		const actor = this.currentActor();
		if (actor.condition !== "active") {
			this.emit({ type: "TurnSkipped", actorId: actor.id, reason: "Down" });
			return false;
		}

		// Start-of-turn status ticks (Trello: Bleed ticks on the owner's turn).
		for (const status of [...actor.statuses]) {
			const tick = StatusHandlers[status.id].onTurnStart(status);
			this.emit({ type: "StatusTicked", targetId: actor.id, label: tick.label, damage: tick.damage });
			if (tick.damage > 0) this.damage(actor, tick.damage, "Torso");
			if (status.duration <= 0) actor.statuses.remove(actor.statuses.indexOf(status));
			if (this.state.outcome !== undefined) return true;
			if (actor.condition !== "active") {
				this.emit({ type: "TurnSkipped", actorId: actor.id, reason: "Down" });
				return false;
			}
		}

		if (actor.staggered) {
			actor.staggered = false;
			this.emit({ type: "TurnSkipped", actorId: actor.id, reason: "Staggered" });
			return false;
		}

		// Trello: Stamina regenerates 1 per turn.
		actor.stamina.current = math.min(actor.stamina.max, actor.stamina.current + CombatConfig.staminaRegenPerTurn);
		this.emit({ type: "TurnStarted", actorId: actor.id, round: this.state.round });
		this.emitResources(actor);
		return true;
	}

	// ── Helpers ─────────────────────────────────────────────────────────────

	private initiativeOf(c: Combatant): number {
		return baseInitiative(c.health.current, c.health.max, c.stats.dexterity);
	}

	private rawDamage(attacker: Combatant, ability: AbilityDef): number {
		let damage = ability.baseDamage;
		for (const entry of ability.scaling) damage += attacker.stats[entry.stat] * entry.ratio * SCALING_UNIT;
		return damage;
	}

	private checkCost(actor: Combatant, ability: AbilityDef): string | undefined {
		if ((ability.cost.stamina ?? 0) > actor.stamina.current) return "Not enough Stamina";
		if ((ability.cost.auxiliary ?? 0) > actor.auxiliary.current) return "Not enough Auxiliary";
		const reservoir = ability.cost.reservoir ?? 0;
		if (reservoir > 0 && (actor.reservoir === undefined || reservoir > actor.reservoir.current)) {
			return "Not enough Reservoir";
		}
		return undefined;
	}

	private payCost(actor: Combatant, ability: AbilityDef) {
		actor.stamina.current -= ability.cost.stamina ?? 0;
		actor.auxiliary.current -= ability.cost.auxiliary ?? 0;
		if (actor.reservoir !== undefined) actor.reservoir.current -= ability.cost.reservoir ?? 0;
		this.emitResources(actor);
	}

	private emitResources(actor: Combatant) {
		this.emit({
			type: "ResourcesChanged",
			actorId: actor.id,
			stamina: actor.stamina.current,
			reservoir: actor.reservoir?.current,
			auxiliary: actor.auxiliary.current,
		});
	}

	private damage(target: Combatant, amount: number, limb: Limb) {
		target.health.current = math.max(0, target.health.current - amount);
		this.emit({ type: "Damaged", targetId: target.id, amount, limb, health: target.health.current });

		if (target.health.current > 0) return;
		// Trello: Health — divers fall unconscious at 0, or implode on massive overkill.
		const implode = target.side === "diver" && isImplosion(amount, target.health.max);
		target.condition = target.side === "diver" && !implode ? "unconscious" : "dead";
		target.statuses.clear();
		this.grid.unblock(target.node);
		this.emit({ type: "Downed", targetId: target.id, condition: target.condition });
		this.checkOutcome();
	}

	private checkOutcome() {
		const alive: Record<Side, boolean> = { diver: false, enemy: false };
		for (const [, c] of this.state.combatants) if (c.condition === "active") alive[c.side] = true;
		if (alive.diver && alive.enemy) return;
		const winner: Side = alive.diver ? "diver" : "enemy";
		this.state.outcome = winner;
		this.state.pending = undefined;
		this.emit({ type: "EncounterEnded", winner });
	}

	private relocate(actor: Combatant, to: NodeId) {
		this.grid.unblock(actor.node);
		actor.node = to;
		this.grid.block(to);
	}

	private syncBlocked() {
		this.grid.clearBlocked();
		for (const [, c] of this.state.combatants) if (c.condition === "active") this.grid.block(c.node);
	}

	private emit(event: CombatEvent) {
		this.events.push(event);
	}

	private flush(): CombatEvent[] {
		const out = this.events;
		this.events = [];
		return out;
	}
}
