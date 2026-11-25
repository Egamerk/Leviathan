import React from "@rbxts/react";
import { ClippedFill } from "client/ui/components/clipped-fill";
import { useSmoothedNumber } from "client/ui/hooks/use-smoothed-number";
import { ArtAspect, HudAnimation, HudArt, type Piece } from "./hud.config";
import { place } from "./hud.layout";

interface ResourceBarProps {
	name: string;
	fraction: number;
	/** Number of points (Auxiliary 2, Stamina 4…); a divider is drawn between each. */
	points: number;
	piece: Piece;
	art: { back: string; glass: string; fill: string; fillLeft: number; fillRight: number };
}

const DIVIDER = HudArt.divider;

/**
 * Auxiliary / Stamina tube: back, glass, a fill that drains/refills smoothly,
 * and brass dividers marking each point so it can be counted at a glance.
 */
export function ResourceBar({ name, fraction, points, piece, art }: ResourceBarProps) {
	const smoothed = useSmoothedNumber(fraction, HudAnimation.barSmoothing);
	const fillWidth = art.fillRight - art.fillLeft;
	// Divider box: its art is a thin line centred in a wide transparent image.
	const barAspect = piece.aspect;
	const dividerHeight = DIVIDER.heightFraction;
	const dividerWidth = (dividerHeight * ArtAspect.divider) / barAspect;

	const layer = (key: string, image: string, zIndex: number) => (
		<imagelabel key={key} BackgroundTransparency={1} Size={UDim2.fromScale(1, 1)} Image={image} ZIndex={zIndex} />
	);

	const dividers = new Array<React.Element>();
	for (let k = 1; k < points; k++) {
		dividers.push(
			<imagelabel
				key={`Divider${k}`}
				AnchorPoint={new Vector2(0.5, 0.5)}
				BackgroundTransparency={1}
				Position={UDim2.fromScale(art.fillLeft + (fillWidth * k) / points, 0.5)}
				Size={UDim2.fromScale(dividerWidth, dividerHeight)}
				Image={DIVIDER.image}
				ZIndex={2}
			/>,
		);
	}

	return (
		<frame key={name} BackgroundTransparency={1} {...place(piece)}>
			{layer("Back", art.back, -1)}
			{layer("Glass", art.glass, 0)}
			<ClippedFill fraction={smoothed} insetLeft={art.fillLeft} insetWidth={fillWidth} zIndex={1}>
				{layer("Fill", art.fill, 1)}
			</ClippedFill>
			{dividers}
		</frame>
	);
}
