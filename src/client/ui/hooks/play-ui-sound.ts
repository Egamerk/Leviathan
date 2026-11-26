import { SoundService } from "@rbxts/services";

/**
 * Plays a one-shot UI sound locally (not positional). Each call makes its own
 * Sound so overlapping plays don't cut each other off; it's removed when done.
 */
export function playUiSound(soundId: string, options?: { volume?: number; pitch?: number }): void {
	const sound = new Instance("Sound");
	sound.SoundId = soundId;
	sound.Volume = options?.volume ?? 0.5;
	sound.PlaybackSpeed = options?.pitch ?? 1;
	sound.Parent = SoundService;
	sound.Ended.Once(() => sound.Destroy());
	sound.Play();
	// Safety net if Ended never fires (e.g. the sound fails to load).
	task.delay(10, () => {
		if (sound.Parent !== undefined) sound.Destroy();
	});
}
