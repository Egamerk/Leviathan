import { Controller, Modding, OnInit, OnStart } from "@flamework/core";
import { Players } from "@rbxts/services";
import type { OnCharacterAdded, OnCharacterRemoving } from "client/lifecycles";

/** Turns local character events into the `OnCharacterAdded` / `OnCharacterRemoving` lifecycles. */
@Controller({ loadOrder: 0 })
export class CharacterLifecycleController implements OnInit, OnStart {
	private readonly added = new Set<OnCharacterAdded>();
	private readonly removing = new Set<OnCharacterRemoving>();

	public onInit(): void {
		Modding.onListenerAdded<OnCharacterAdded>((listener) => this.added.add(listener));
		Modding.onListenerRemoved<OnCharacterAdded>((listener) => this.added.delete(listener));
		Modding.onListenerAdded<OnCharacterRemoving>((listener) => this.removing.add(listener));
		Modding.onListenerRemoved<OnCharacterRemoving>((listener) => this.removing.delete(listener));
	}

	/** Dispatch only after every controller has finished `onInit`. */
	public onStart(): void {
		const player = Players.LocalPlayer;
		player.CharacterAdded.Connect((character) => this.dispatchAdded(character));
		player.CharacterRemoving.Connect((character) => {
			for (const listener of this.removing) task.spawn(() => listener.onCharacterRemoving(character));
		});
		if (player.Character) this.dispatchAdded(player.Character);
	}

	private dispatchAdded(character: Model): void {
		for (const listener of this.added) task.spawn(() => listener.onCharacterAdded(character));
	}
}
