import React from "@rbxts/react";
import { ClippedFill } from "client/ui/components/clipped-fill";
import { useSmoothedNumber } from "client/ui/hooks/use-smoothed-number";
import { HudAnimation } from "./hud.config";

interface ResourceBarProps {
	name: string;
	fraction: number;
	anchor: Vector2;
	position: UDim2;
	size: UDim2;
	back: string;
	glass: string;
	fill: string;
}

/** Auxiliary / Stamina capsule: back plate, glass, and a fill that drains smoothly. */
export function ResourceBar(props: ResourceBarProps) {
	const fraction = useSmoothedNumber(props.fraction, HudAnimation.barSmoothing);
	const layer = (key: string, image: string, zIndex: number) => (
		<imagelabel
			key={key}
			BackgroundTransparency={1}
			Size={UDim2.fromScale(1, 1)}
			Image={image}
			ScaleType={Enum.ScaleType.Fit}
			ZIndex={zIndex}
		/>
	);

	return (
		<frame
			key={props.name}
			AnchorPoint={props.anchor}
			BackgroundTransparency={1}
			Position={props.position}
			Size={props.size}
		>
			{layer("Back", props.back, -1)}
			{layer("Glass", props.glass, 0)}
			<ClippedFill fraction={fraction} zIndex={1}>
				{layer("Fill", props.fill, 1)}
			</ClippedFill>
		</frame>
	);
}
