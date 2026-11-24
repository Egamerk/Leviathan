import { Modding, OnInit, Service } from "@flamework/core";
import Log from "@rbxts/log";
import ProfileStore from "@rbxts/profile-store";
import { RunService } from "@rbxts/services";
import type { OnPlayerDataLoaded, OnPlayerJoined, OnPlayerLeaving } from "server/lifecycles";
import { playerDataAtom, withEntry } from "server/store";
import { GameConfig } from "shared/config";
import { DEFAULT_PLAYER_DATA, type PlayerData } from "shared/schemas/player-data";

type Profile = ReturnType<ReturnType<typeof ProfileStore.New<PlayerData>>["StartSessionAsync"]>;

/**
 * Owns player persistence. The ONLY place that touches ProfileStore.
 *
 * Other services read with `get(player)` and write with `update(player, fn)`;
 * updates go to both the profile (saved) and `playerDataAtom` (replicated).
 */
@Service({ loadOrder: 1 })
export class PlayerDataService implements OnInit, OnPlayerJoined, OnPlayerLeaving {
	private readonly logger = Log.ForContext(PlayerDataService);
	// Studio uses a mock store so play-testing never touches live data.
	private readonly store = RunService.IsStudio()
		? ProfileStore.New(GameConfig.profileStoreName, DEFAULT_PLAYER_DATA).Mock
		: ProfileStore.New(GameConfig.profileStoreName, DEFAULT_PLAYER_DATA);
	private readonly profiles = new Map<Player, Profile>();
	private readonly leaving = new Set<Player>();
	private readonly loadedListeners = new Set<OnPlayerDataLoaded>();

	public onInit(): void {
		Modding.onListenerAdded<OnPlayerDataLoaded>((listener) => this.loadedListeners.add(listener));
		Modding.onListenerRemoved<OnPlayerDataLoaded>((listener) => this.loadedListeners.delete(listener));
	}

	public onPlayerJoined(player: Player): void {
		const profile = this.store.StartSessionAsync(`${GameConfig.profileKeyPrefix}${player.UserId}`, {
			Cancel: () => player.Parent === undefined,
		});
		if (profile === undefined) {
			player.Kick("Your data couldn't be loaded. Please rejoin.");
			return;
		}

		profile.AddUserId(player.UserId); // GDPR compliance
		profile.Reconcile(); // fill in fields added to the template since last save
		this.migrate(profile.Data);

		profile.OnSessionEnd.Connect(() => {
			this.profiles.delete(player);
			this.setAtom(player, undefined);
			// Session ended elsewhere (another server took it, or shutdown) while still here.
			if (!this.leaving.delete(player) && player.Parent !== undefined) {
				player.Kick("Your data session ended. Please rejoin.");
			}
		});

		if (player.Parent === undefined) {
			profile.EndSession(); // left while loading
			return;
		}

		this.profiles.set(player, profile);
		this.setAtom(player, profile.Data);
		this.logger.Info("Loaded data for {Player}", player.Name);
		for (const listener of this.loadedListeners) task.spawn(() => listener.onPlayerDataLoaded(player));
	}

	public onPlayerLeaving(player: Player): void {
		const profile = this.profiles.get(player);
		if (profile === undefined) return;
		this.leaving.add(player);
		profile.EndSession();
	}

	/** Current data, or undefined if the profile isn't loaded (yet). */
	public get(player: Player): Readonly<PlayerData> | undefined {
		return this.profiles.get(player)?.Data;
	}

	/**
	 * Immutable update: `fn` returns the new data object. Returns false if the
	 * profile isn't loaded.
	 */
	public update(player: Player, fn: (data: Readonly<PlayerData>) => PlayerData): boolean {
		const profile = this.profiles.get(player);
		if (profile === undefined || !profile.IsActive()) return false;
		profile.Data = fn(profile.Data);
		this.setAtom(player, profile.Data);
		return true;
	}

	/** Upgrade old saves in place. Add a step per `schemaVersion` bump. */
	private migrate(data: PlayerData): void {
		// if (data.schemaVersion < 2) { …; data.schemaVersion = 2; }
		data.schemaVersion = DEFAULT_PLAYER_DATA.schemaVersion;
	}

	private setAtom(player: Player, data: PlayerData | undefined): void {
		playerDataAtom((current) => withEntry(current, player.UserId, data && table.clone(data)));
	}
}
