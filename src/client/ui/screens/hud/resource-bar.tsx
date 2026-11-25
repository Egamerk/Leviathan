import React, { type Binding } from "@rbxts/react";
import { useAnimationClock } from "client/ui/hooks/use-animation-clock";
import { useSmoothedNumber } from "client/ui/hooks/use-smoothed-number";
import { ArtAspect, HudAnimation, HudArt, type Piece } from "./hud.config";
import { place } from "./hud.layout";

export interface ResourceBarArt {
	back: string;
	glass: string;
	/** Side of the brass cap. The liquid stays anchored there and drains from the other end. */
	anchor: "left" | "right";
	fillLeft: number;
	fillRight: number;
	fillTop: number;
	fillBottom: number;
	flowTile: string;
	flowTileAspect: number;
}

interface ResourceBarProps {
	name: string;
	fraction: number;
	/** Number of points (Auxiliary 2, Stamina 4…); a divider is drawn between each. */
	points: number;
	piece: Piece;
	art: ResourceBarArt;
	/** 1 = flows rightward, -1 = leftward. */
	flowDirection: number;
}

const DIVIDER = HudArt.divider;
const MIN_FRACTION = 1e-3;

/**
 * Flowing liquid, anchored at the cap side and draining from the other end.
 *
 * Coordinates inside the `Box` frame are fractions of the liquid area (the
 * "fill box"), so the texture keeps its scale while the level changes:
 *
 *   Clip       rectangle covering the filled part, so the cap end is SQUARE
 *   └ Box      counter-sized to the whole fill box
 *     └ Liquid rounded CanvasGroup (pill) from the moving edge to past the
 *       │      cap edge. The cap-side rounding falls outside Clip and is cut
 *       │      off, so only the moving end is round.
 *       └ Tex  the fill box again, holding ONE ScaleType.Tile ImageLabel that scrolls
 */
function FlowingFill(props: {
	fraction: Binding<number>;
	art: ResourceBarArt;
	barAspect: number;
	barWidthHw: number;
	flowDirection: number;
}) {
	const { fraction, art, barAspect, barWidthHw, flowDirection } = props;
	const clock = useAnimationClock();
	const fromRight = art.anchor === "right";
	const fillWidth = art.fillRight - art.fillLeft;
	const fillHeight = art.fillBottom - art.fillTop;
	const pillAspect = (fillWidth * barAspect) / fillHeight; // fill box width ÷ height, in pixels
	// How far the pill extends past the cap edge, in fill-box widths (≥ its corner radius).
	const overhang = 1 / pillAspect;
	// Tile width in fill-box widths: the tile spans the box's height, keeping its aspect.
	const tileWidth = art.flowTileAspect / pillAspect;
	const labelWidth = 1 + tileWidth;
	// Shared on-screen speed (hw/s) converted to fill-box widths per second.
	const speed = HudAnimation.liquidSpeed / (barWidthHw * fillWidth);
	const offset = clock.map((t) => {
		const phase = (t * speed) % tileWidth;
		return flowDirection >= 0 ? phase - tileWidth : -phase;
	});

	const level = fraction.map((f) => math.max(f, MIN_FRACTION));
	// Liquid (pill) extent in fill-box units: [start, start + width].
	const pillStart = level.map((f) => (fromRight ? 1 - f : -overhang));
	const pillWidth = level.map((f) => f + overhang);

	return (
		<frame
			key="Clip"
			AnchorPoint={new Vector2(fromRight ? 1 : 0, 0)}
			BackgroundTransparency={1}
			ClipsDescendants={true}
			Position={UDim2.fromScale(fromRight ? art.fillRight : art.fillLeft, art.fillTop)}
			Size={level.map((f) => UDim2.fromScale(fillWidth * f, fillHeight))}
			Visible={fraction.map((f) => f > MIN_FRACTION)}
			ZIndex={1}
		>
			<frame
				key="Box"
				AnchorPoint={new Vector2(fromRight ? 1 : 0, 0)}
				BackgroundTransparency={1}
				Position={UDim2.fromScale(fromRight ? 1 : 0, 0)}
				Size={level.map((f) => UDim2.fromScale(1 / f, 1))}
			>
				<canvasgroup
					key="Liquid"
					BackgroundTransparency={1}
					Position={pillStart.map((x) => UDim2.fromScale(x, 0))}
					Size={pillWidth.map((w) => UDim2.fromScale(w, 1))}
				>
					<uicorner CornerRadius={new UDim(0.5, 0)} />
					<frame
						key="Tex"
						BackgroundTransparency={1}
						Position={level.map((f) => {
							const start = fromRight ? 1 - f : -overhang;
							return UDim2.fromScale(-start / (f + overhang), 0);
						})}
						Size={pillWidth.map((w) => UDim2.fromScale(1 / w, 1))}
					>
						<imagelabel
							key="Tile"
							BackgroundTransparency={1}
							Image={art.flowTile}
							ScaleType={Enum.ScaleType.Tile}
							TileSize={UDim2.fromScale(tileWidth / labelWidth, 1)}
							Position={offset.map((x) => UDim2.fromScale(x, 0))}
							Size={UDim2.fromScale(labelWidth, 1)}
						/>
					</frame>
				</canvasgroup>
			</frame>
		</frame>
	);
}

/**
 * Auxiliary / Stamina tube: back, glass, flowing liquid anchored at the cap,
 * and brass dividers marking each point.
 */
export function ResourceBar({ name, fraction, points, piece, art, flowDirection }: ResourceBarProps) {
	const smoothed = useSmoothedNumber(fraction, HudAnimation.barSmoothing);
	const fillWidth = art.fillRight - art.fillLeft;
	// Divider box: its art is a thin line centred in a wide transparent image.
	const dividerHeight = DIVIDER.heightFraction;
	const dividerWidth = (dividerHeight * ArtAspect.divider) / piece.aspect;

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
			<FlowingFill
				fraction={smoothed}
				art={art}
				barAspect={piece.aspect}
				barWidthHw={piece.width}
				flowDirection={flowDirection}
			/>
			{dividers}
		</frame>
	);
}
