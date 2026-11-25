import { Controller, OnStart } from "@flamework/core";
import Log from "@rbxts/log";
import { ContentProvider } from "@rbxts/services";
import { Images } from "shared/assets/images";

/**
 * Preloads every UI image at startup and reports any that fail, by name, in
 * Output. A failure usually means the asset is still in moderation, was
 * rejected, or the id is a Decal id rather than an Image id.
 */
@Controller()
export class AssetPreloadController implements OnStart {
	private readonly logger = Log.ForContext(AssetPreloadController);

	public onStart(): void {
		const names = new Map<string, string>();
		const ids = new Array<string>();
		for (const [name, id] of pairs(Images)) {
			names.set(id, name);
			ids.push(id);
		}

		task.spawn(() => {
			const failed = new Array<string>();
			ContentProvider.PreloadAsync(ids, (contentId, status) => {
				if (status !== Enum.AssetFetchStatus.Success) {
					failed.push(names.get(contentId) ?? contentId);
					this.logger.Warn(
						"UI image {Name} ({Id}) failed to load: {Status}",
						names.get(contentId) ?? "?",
						contentId,
						status.Name,
					);
				}
			});
			if (failed.size() === 0) this.logger.Info("All {Count} UI images loaded", ids.size());
			else this.logger.Warn("{Count} UI image(s) failed to load: {Names}", failed.size(), failed.join(", "));
		});
	}
}
