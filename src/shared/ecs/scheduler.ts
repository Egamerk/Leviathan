import { Scheduler } from "@rbxts/planck";
import { Plugin } from "@rbxts/planck-runservice";
import { World } from "@rbxts/jecs";
import { RunService } from "@rbxts/services";
import { world } from "shared/ecs/world";

export type SystemArgs = [World];

/** Presentation and other frame-rate-dependent systems. */
export const variableScheduler = new Scheduler<SystemArgs>(world);
variableScheduler.addPlugin(new Plugin());

/** Deterministic simulation systems (combat, status effects, AI decisions). */
export const fixedScheduler = new Scheduler<SystemArgs>(world);

export const FIXED_STEP = 1 / 30;
const MAX_STEPS_PER_FRAME = 5;

let fixedStepStarted = false;

/** Starts a bounded accumulator to prevent a lag spike from causing a death spiral. */
export function startFixedStep(): void {
	if (fixedStepStarted) return;
	fixedStepStarted = true;

	let accumulator = 0;
	RunService.Heartbeat.Connect((deltaTime) => {
		accumulator = math.min(accumulator + deltaTime, FIXED_STEP * MAX_STEPS_PER_FRAME);

		let steps = 0;
		while (accumulator >= FIXED_STEP && steps < MAX_STEPS_PER_FRAME) {
			fixedScheduler.runAll();
			accumulator -= FIXED_STEP;
			steps += 1;
		}
	});
}
