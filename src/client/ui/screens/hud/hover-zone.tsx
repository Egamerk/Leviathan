import React from "@rbxts/react";
import type { Piece } from "./hud.config";
import { place } from "./hud.layout";
import type { HudElement } from "./hud.tooltips";

interface HoverZoneProps {
	element: HudElement;
	piece: Piece;
	/** Grow the hit area around the piece (fraction of its size). */
	pad?: number;
	onHover: (element: HudElement | undefined, toggle?: boolean) => void;
}

/**
 * Invisible hit area over a HUD element. Mouse: hover shows its tooltip.
 * Touch: tapping toggles it.
 */
export function HoverZone({ element, piece, pad = 0, onHover }: HoverZoneProps) {
	const grown: Piece = { ...piece, width: piece.width * (1 + pad), aspect: piece.aspect };
	return (
		<textbutton
			key={`Hover_${element}`}
			AutoButtonColor={false}
			BackgroundTransparency={1}
			Text=""
			ZIndex={40}
			Event={{
				MouseEnter: () => onHover(element),
				MouseLeave: () => onHover(undefined),
				Activated: () => onHover(element, true),
			}}
			{...place(grown)}
		/>
	);
}
