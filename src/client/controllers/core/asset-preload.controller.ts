import { Controller, OnStart } from "@flamework/core";
import Log from "@rbxts/log";
import { ContentProvider } from "@rbxts/services";
import { Images } from "shared/assets/images";

/**
 * Preloads every UI image at startup and reports any that fail, by name, in
 * Output. Each id is loaded through an ImageLabel, so the result reflects
 * what the HUD can actually display. (A bare id string can't be preloaded as
 * an image, so it reports Failure even for working images.) A real failure
 * usually means the asset is still in moderation, was rejected, or the id is
 * a Decal id rather than an Image id.
 */
@Controller()
export class AssetPreloadController implements OnStart {
	private readonly logger = Log.ForContext(AssetPreloadController);

	public onStart(): void {
		const labels = new Array<ImageLabel>();
		const names = new Map<string, string>();
		for (const [name, id] of pairs(Images)) {
			const label = new Instance("ImageLabel");
			label.Image = id;
			labels.push(label);
			names.set(id, name);
		}

		task.spawn(() => {
			const failed = new Array<string>();
			ContentProvider.PreloadAsync(labels, (contentId, status) => {
				if (status === Enum.AssetFetchStatus.Success) return;
				const name = names.get(contentId) ?? contentId;
				failed.push(name);
				this.logger.Warn("UI image {Name} ({Id}) failed to load: {Status}", name, contentId, status.Name);
			});
			for (const label of labels) label.Destroy();
			if (failed.size() === 0) this.logger.Info("All {Count} UI images loaded", labels.size());
			else this.logger.Warn("{Count} UI image(s) failed to load: {Names}", failed.size(), failed.join(", "));
		});
	}
}
