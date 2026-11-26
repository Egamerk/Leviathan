import React from "@rbxts/react";
import { FRAME_BOLDNESS, type FrameArt } from "./inventory.config";

/** Art scale (screen px per art px) for a tile of `tile` pixels, shrunk if the fixed pieces wouldn't fit. */
export function frameScale(art: FrameArt, tile: number): number {
	const fixed = 2 * art.corner + (art.middleEnd - art.middleStart);
	return math.min(tile * FRAME_BOLDNESS, (tile * 0.9) / fixed);
}

interface FrameBorderProps {
	art: FrameArt;
	/** Tile size in pixels. */
	tile: number;
	color?: Color3;
	zIndex?: number;
}

/**
 * Draws a square border image as 5×5 pieces (only the outer ring): corners and
 * the middle connectors at a fixed scale, the plain lines between them
 * stretched. Unlike scaling the whole image down, the lines stay as thick and
 * the ornaments as detailed as in the art.
 */
export function FrameBorder({ art, tile, color, zIndex }: FrameBorderProps) {
	if (tile <= 0) return undefined;
	const k = frameScale(art, tile);
	const W = art.size;
	// Art cuts and their on-screen sizes (columns and rows are the same: the art is square and symmetric).
	const cuts = [0, art.corner, art.middleStart, art.middleEnd, W - art.corner, W];
	const fixedPx = (2 * art.corner + (art.middleEnd - art.middleStart)) * k;
	const stretchPx = (tile - fixedPx) / 2;
	const screen = [art.corner * k, stretchPx, (art.middleEnd - art.middleStart) * k, stretchPx, art.corner * k];
	const starts = [0];
	for (let i = 0; i < 4; i++) starts.push(starts[i] + screen[i]);

	const pieces = new Array<React.Element>();
	for (let row = 0; row < 5; row++) {
		for (let col = 0; col < 5; col++) {
			// Only the outer ring: the inside of the art is transparent.
			if (row !== 0 && row !== 4 && col !== 0 && col !== 4) continue;
			pieces.push(
				<imagelabel
					key={`P${row}${col}`}
					BackgroundTransparency={1}
					Image={art.image}
					ImageColor3={color}
					ImageRectOffset={new Vector2(cuts[col], cuts[row])}
					ImageRectSize={new Vector2(cuts[col + 1] - cuts[col], cuts[row + 1] - cuts[row])}
					// Round to whole pixels so neighbouring pieces meet without seams.
					Position={UDim2.fromOffset(math.round(starts[col]), math.round(starts[row]))}
					Size={UDim2.fromOffset(
						math.round(starts[col] + screen[col]) - math.round(starts[col]),
						math.round(starts[row] + screen[row]) - math.round(starts[row]),
					)}
					ZIndex={zIndex}
				/>,
			);
		}
	}
	return <>{pieces}</>;
}
