import { Lighting, Workspace } from "@rbxts/services";

/**
 * Approximate light level (0..1) at a position: ambient from Lighting plus every
 * PointLight/SpotLight/SurfaceLight in range. A diver's own Lantern (Trello:
 * Auxiliary → Lantern) is a light on their character, so it counts automatically,
 * which gives the trade-off the board implies: a lit diver can't be ambushed
 * (Trello: "without being in a well lit area") but is visible from further away.
 */

const lights = new Set<Light>();

function track(instance: Instance) {
	if (instance.IsA("PointLight") || instance.IsA("SpotLight") || instance.IsA("SurfaceLight")) {
		lights.add(instance);
		instance.AncestryChanged.Connect(() => {
			if (!instance.IsDescendantOf(Workspace)) lights.delete(instance);
		});
	}
}

export function startLightTracking() {
	for (const descendant of Workspace.GetDescendants()) track(descendant);
	Workspace.DescendantAdded.Connect(track);
}

export function lightLevelAt(position: Vector3): number {
	const ambient = Lighting.Ambient;
	let level = math.clamp(((ambient.R + ambient.G + ambient.B) / 3) * 0.6, 0, 0.6);

	for (const light of lights) {
		if (!light.Enabled) continue;
		const parent = light.Parent;
		let source: Vector3 | undefined;
		if (parent?.IsA("BasePart")) source = parent.Position;
		else if (parent?.IsA("Attachment")) source = parent.WorldPosition;
		if (source === undefined) continue;

		const range = (light as PointLight).Range ?? 8;
		const distance = source.sub(position).Magnitude;
		if (distance >= range) continue;
		level += (1 - distance / range) * math.clamp(light.Brightness, 0, 2) * 0.5;
		if (level >= 1) return 1;
	}
	return math.clamp(level, 0, 1);
}
