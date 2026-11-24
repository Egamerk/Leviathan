import React from "@rbxts/react";
import { ClippedFill } from "client/ui/components/clipped-fill";
import { useSmoothedNumber } from "client/ui/hooks/use-smoothed-number";
import { HudAnimation, type Piece } from "./hud.config";
import { place } from "./hud.layout";

interface ResourceBarProps {
	name: string;
	fraction: number;
	piece: Piece;
	art: { back: string; glass: string; fill: string };
}

/** Auxiliary / Stamina tube: back, glass, and a fill that drains/refills smoothly. */
export function ResourceBar({ name, fraction, piece, art }: ResourceBarProps) {
	const smoothed = useSmoothedNumber(fraction, HudAnimation.barSmoothing);
	const layer = (key: string, image: string, zIndex: number) => (
		<imagelabel key={key} BackgroundTransparency={1} Size={UDim2.fromScale(1, 1)} Image={image} ZIndex={zIndex} />
	);

	return (
		<frame key={name} BackgroundTransparency={1} {...place(piece)}>
			{layer("Back", art.back, -1)}
			{layer("Glass", art.glass, 0)}
			<ClippedFill fraction={smoothed} zIndex={1}>
				{layer("Fill", art.fill, 1)}
			</ClippedFill>
		</frame>
	);
}
