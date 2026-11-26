import { Controller, OnStart } from "@flamework/core";
import Log from "@rbxts/log";
import { CollectionService, Lighting, Players, TweenService, Workspace } from "@rbxts/services";
import {
	isLightingPreset,
	LightingBlendSeconds,
	LightingDefault,
	LightingOverrideAttribute,
	type LightingPreset,
	type LightingPresetName,
	LightingPresets,
	LightingZoneTag,
} from "shared/config/lighting";

/** How often (seconds) to check which zone the player is in. */
const CHECK_INTERVAL = 0.25;
const EFFECT_PREFIX = "Leviathan_";

interface Effects {
	atmosphere: Atmosphere;
	colorCorrection: ColorCorrectionEffect;
	bloom: BloomEffect;
	sunRays: SunRaysEffect;
	depthOfField: DepthOfFieldEffect;
}

/**
 * Applies the lighting preset for the zone the player is in, blending
 * smoothly between presets (see shared/config/lighting.ts for presets,
 * zones and testing).
 *
 * It owns one Atmosphere and its own post effects under Lighting. Other post
 * effects of the same kinds already in Lighting are disabled while playing
 * (not deleted) so they don't stack on top.
 */
@Controller()
export class LightingController implements OnStart {
	private readonly logger = Log.ForContext(LightingController);
	private current?: LightingPresetName;
	private effects!: Effects;

	public onStart(): void {
		this.effects = this.createEffects();
		this.apply(this.target(), 0);
		task.spawn(() => {
			while (task.wait(CHECK_INTERVAL)) {
				const target = this.target();
				if (target !== this.current) this.apply(target, LightingBlendSeconds);
			}
		});
		Workspace.GetAttributeChangedSignal(LightingOverrideAttribute).Connect(() => {
			const forced = Workspace.GetAttribute(LightingOverrideAttribute);
			if (forced !== undefined && !isLightingPreset(forced)) {
				this.logger.Warn("Unknown lighting preset {Name}", tostring(forced));
			}
		});
	}

	/** Forced preset > highest-priority zone containing the player > default. */
	private target(): LightingPresetName {
		const forced = Workspace.GetAttribute(LightingOverrideAttribute);
		if (isLightingPreset(forced)) return forced;

		const position = this.focusPosition();
		if (position === undefined) return LightingDefault;

		let best: LightingPresetName | undefined;
		let bestPriority = -math.huge;
		for (const zone of CollectionService.GetTagged(LightingZoneTag)) {
			if (!zone.IsA("BasePart")) continue;
			const preset = zone.GetAttribute("Preset");
			if (!isLightingPreset(preset)) continue;
			const offset = zone.CFrame.PointToObjectSpace(position);
			const half = zone.Size.div(2);
			if (math.abs(offset.X) > half.X || math.abs(offset.Y) > half.Y || math.abs(offset.Z) > half.Z) continue;
			const priority = (zone.GetAttribute("Priority") as number | undefined) ?? 0;
			if (priority > bestPriority) {
				best = preset;
				bestPriority = priority;
			}
		}
		return best ?? LightingDefault;
	}

	/** The character's root part, else the camera. */
	private focusPosition(): Vector3 | undefined {
		const root = Players.LocalPlayer.Character?.FindFirstChild("HumanoidRootPart");
		if (root?.IsA("BasePart")) return root.Position;
		return Workspace.CurrentCamera?.CFrame.Position;
	}

	private apply(name: LightingPresetName, seconds: number): void {
		const preset: LightingPreset = LightingPresets[name];
		this.current = name;
		this.logger.Info("Lighting: {Preset}", name);
		const info = new TweenInfo(seconds, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut);
		const tween = <T extends Instance>(instance: T, goal: Partial<ExtractMembers<T, Tweenable>>) => {
			if (seconds <= 0) {
				for (const [key, value] of pairs(goal as object)) {
					(instance as unknown as Record<string, unknown>)[key as string] = value;
				}
			} else {
				TweenService.Create(instance, info, goal).Play();
			}
		};
		tween(Lighting, preset.lighting);
		tween(this.effects.atmosphere, preset.atmosphere);
		tween(this.effects.colorCorrection, preset.colorCorrection);
		tween(this.effects.bloom, preset.bloom);
		tween(this.effects.sunRays, preset.sunRays);
		tween(this.effects.depthOfField, preset.depthOfField);
	}

	private createEffects(): Effects {
		const own = <T extends keyof CreatableInstances>(className: T, key: string): CreatableInstances[T] => {
			const name = EFFECT_PREFIX + key;
			for (const child of Lighting.GetChildren()) {
				if (!child.IsA("PostEffect") || child.ClassName !== className || child.Name === name) continue;
				child.Enabled = false;
				this.logger.Info("Disabled existing {Class} {Name} so it doesn't stack", className, child.Name);
			}
			const existing = Lighting.FindFirstChild(name);
			if (existing !== undefined && existing.ClassName === className) return existing as CreatableInstances[T];
			const instance = new Instance(className);
			instance.Name = name;
			instance.Parent = Lighting;
			return instance;
		};

		// Only one Atmosphere can be active: reuse the place's if it has one.
		let atmosphere = Lighting.FindFirstChildOfClass("Atmosphere");
		if (atmosphere === undefined) {
			atmosphere = new Instance("Atmosphere");
			atmosphere.Name = EFFECT_PREFIX + "Atmosphere";
			atmosphere.Parent = Lighting;
		}

		return {
			atmosphere,
			colorCorrection: own("ColorCorrectionEffect", "ColorCorrection"),
			bloom: own("BloomEffect", "Bloom"),
			sunRays: own("SunRaysEffect", "SunRays"),
			depthOfField: own("DepthOfFieldEffect", "DepthOfField"),
		};
	}
}
