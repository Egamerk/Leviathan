import React, { type Binding } from "@rbxts/react";

const MIN_FRACTION = 1e-3;

interface ClippedFillProps extends React.PropsWithChildren {
	/** 0..1 how much of the fill area is visible (empties from the right). */
	fraction: Binding<number>;
	/** Left edge of the fillable area, as a fraction of the parent's width. */
	insetLeft?: number;
	/** Width of the fillable area, as a fraction of the parent's width. */
	insetWidth?: number;
	zIndex?: number;
}

/**
 * Reveals its children left-to-right by `fraction` without stretching them.
 *
 * A clipping frame shrinks with the fraction, while an inner frame is
 * counter-sized to stay exactly the parent's size, so children keep the same
 * position/size/scale they'd have in the parent. Fill art is laid out as if
 * the bar were full.
 */
export function ClippedFill({ fraction, insetLeft = 0, insetWidth = 1, zIndex, children }: ClippedFillProps) {
	const clipWidth = fraction.map((f) => insetWidth * math.max(f, MIN_FRACTION));
	return (
		<frame
			key="Clip"
			BackgroundTransparency={1}
			ClipsDescendants={true}
			Position={new UDim2(insetLeft, 0, 0, 0)}
			Size={clipWidth.map((w) => new UDim2(w, 0, 1, 0))}
			Visible={fraction.map((f) => f > MIN_FRACTION)}
			ZIndex={zIndex}
		>
			<frame
				key="Full"
				BackgroundTransparency={1}
				Position={clipWidth.map((w) => new UDim2(-insetLeft / w, 0, 0, 0))}
				Size={clipWidth.map((w) => new UDim2(1 / w, 0, 1, 0))}
			>
				{children}
			</frame>
		</frame>
	);
}
