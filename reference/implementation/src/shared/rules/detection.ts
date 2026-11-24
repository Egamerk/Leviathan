import { DetectionConfig } from "shared/config";
import type { EncounterKind } from "./initiative";

export interface SightInput {
	/** Enemy eye → target. */
	offset: Vector3;
	/** Enemy look direction (unit). */
	look: Vector3;
	hasLineOfSight: boolean;
	crouching: boolean;
	/** 0..0.9, from Dexterity (Trello: +1% stealth per point). */
	stealth: number;
	/** 0..1 light level at the target. Dark areas shrink sight range. */
	light: number;
}

/** Effective sight range after crouch, stealth and lighting. */
export function effectiveSightRange(input: Pick<SightInput, "crouching" | "stealth" | "light">): number {
	let range = DetectionConfig.sightRange * (1 - input.stealth);
	if (input.crouching) range *= DetectionConfig.crouchRangeMultiplier;
	range *= 0.5 + 0.5 * math.clamp(input.light, 0, 1);
	return range;
}

/**
 * Suspicion gained per second. 0 when the target is unseen. Closer and more
 * central targets fill the meter faster, which gives the player a readable
 * "you're being noticed" window before a pursuit starts.
 */
export function suspicionRate(input: SightInput): number {
	const distance = input.offset.Magnitude;
	if (distance < 1e-3) return DetectionConfig.suspicionGainPerSecond * 4;
	if (!input.hasLineOfSight) return 0;

	const proximity = DetectionConfig.proximityRange * (input.crouching ? 0.5 : 1);
	if (distance <= proximity) return DetectionConfig.suspicionGainPerSecond * 3;

	const range = effectiveSightRange(input);
	if (distance > range) return 0;

	const cosHalfFov = math.cos(math.rad(DetectionConfig.fieldOfViewDegrees / 2));
	const facing = input.look.Dot(input.offset.Unit);
	if (facing < cosHalfFov) return 0;

	const distanceFactor = 1 - distance / range; // 1 near, 0 at edge
	const centerFactor = (facing - cosHalfFov) / (1 - cosHalfFov); // 1 dead centre
	return DetectionConfig.suspicionGainPerSecond * (0.25 + 0.75 * distanceFactor) * (0.5 + 0.5 * centerFactor);
}

/**
 * Trello: Out of Combat → Initiative/Encounter.
 * Called when an enemy reaches a diver. If the diver is facing the enemy, or the
 * area is well lit, it's head-on; otherwise the enemy gets an ambush.
 */
export function classifyEnemyEngage(diverLook: Vector3, diverToEnemy: Vector3, light: number): EncounterKind {
	const flat = new Vector3(diverToEnemy.X, 0, diverToEnemy.Z);
	const look = new Vector3(diverLook.X, 0, diverLook.Z);
	if (flat.Magnitude < 1e-3 || look.Magnitude < 1e-3) return "HeadOn";
	const facing = look.Unit.Dot(flat.Unit) >= math.cos(math.rad(DetectionConfig.facingConeDegrees / 2));
	if (facing || light >= DetectionConfig.litThreshold) return "HeadOn";
	return "EnemyAmbush";
}
