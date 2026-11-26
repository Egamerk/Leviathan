import React from "@rbxts/react";

interface SlicedImageProps {
	image: string;
	/** Width ÷ height of the art. */
	artAspect: number;
	/** Width ÷ height of the box it fills (the parent frame). */
	boxAspect: number;
	/** Width of each end region kept unstretched, as a fraction of the art's width. */
	cap: number;
	zIndex?: number;
}

/** Overlap between the three parts (fraction of the box) so no seam shows. */
const SEAM = 0.002;

/**
 * Fills its parent with `image`, keeping both end caps at their real shape
 * and stretching only the middle when the box is wider than the art (a
 * horizontal 3-slice that needs no pixel sizes). Narrower boxes stretch
 * normally.
 */
export function SlicedImage({ image, artAspect, boxAspect, cap, zIndex }: SlicedImageProps) {
	// Art width in box widths when drawn at the box's height.
	const s = artAspect / boxAspect;
	if (s >= 0.999) {
		return <imagelabel BackgroundTransparency={1} Image={image} Size={UDim2.fromScale(1, 1)} ZIndex={zIndex} />;
	}
	const capWidth = cap * s;
	const part = (key: string, x: number, width: number, imageX: number, imageWidth: number) => (
		<frame
			key={key}
			BackgroundTransparency={1}
			ClipsDescendants={true}
			Position={UDim2.fromScale(x, 0)}
			Size={UDim2.fromScale(width, 1)}
			ZIndex={zIndex}
		>
			<imagelabel
				BackgroundTransparency={1}
				Image={image}
				Position={UDim2.fromScale(imageX, 0)}
				Size={UDim2.fromScale(imageWidth, 1)}
				ZIndex={zIndex}
			/>
		</frame>
	);
	const middleWidth = 1 - 2 * capWidth + 2 * SEAM;
	return (
		<>
			{part("CapLeft", 0, capWidth, 0, 1 / cap)}
			{/* The art's middle [cap, 1 - cap] stretched over the box between the caps. */}
			{part(
				"Middle",
				capWidth - SEAM,
				middleWidth,
				(SEAM - (cap / (1 - 2 * cap)) * (1 - 2 * capWidth)) / middleWidth,
				((1 / (1 - 2 * cap)) * (1 - 2 * capWidth)) / middleWidth,
			)}
			{part("CapRight", 1 - capWidth, capWidth, 1 - 1 / cap, 1 / cap)}
		</>
	);
}

/** Where an edge inset of the art (fraction of its width, measured from that end) lands in the widened box. */
export function slicedInset(inset: number, artAspect: number, boxAspect: number): number {
	return inset * math.min(artAspect / boxAspect, 1);
}
