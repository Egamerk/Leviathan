import React, { type Binding } from "@rbxts/react";
import { ClippedFill } from "client/ui/components/clipped-fill";
import { useAnimationClock } from "client/ui/hooks/use-animation-clock";
import { useSmoothedNumber } from "client/ui/hooks/use-smoothed-number";
import { ArtAspect, HudAnimation, HudArt, type Piece } from "./hud.config";
import { place } from "./hud.layout";

export interface ResourceBarArt {
	back: string;
	glass: string;
	fill: string;
	fillLeft: number;
	fillRight: number;
	fillTop: number;
	fillBottom: number;
	flowTile?: string;
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
 * Flowing liquid: a rounded CanvasGroup (the pill shape) that shrinks with the
 * fraction, holding ONE `ScaleType.Tile` ImageLabel that scrolls the seamless
 * strip. An inner frame is counter-sized so the texture keeps its scale while
 * the pill drains.
 */
function FlowingFill(props: {
	fraction: Binding<number>;
	art: ResourceBarArt & { flowTile: string };
	barAspect: number;
	barWidthHw: number;
	flowDirection: number;
}) {
	const { fraction, art, barAspect, barWidthHw, flowDirection } = props;
	const clock = useAnimationClock();
	const fillWidth = art.fillRight - art.fillLeft;
	const fillHeight = art.fillBottom - art.fillTop;
	// Tile width in pill widths: the tile spans the pill's height, keeping its aspect.
	const pillAspect = (fillWidth * barAspect) / fillHeight;
	const tileWidth = art.flowTileAspect / pillAspect;
	const labelWidth = 1 + tileWidth;
	// Shared on-screen speed (hw/s) converted to pill widths per second.
	const speed = HudAnimation.liquidSpeed / (barWidthHw * fillWidth);
	const offset = clock.map((t) => {
		const phase = (t * speed) % tileWidth;
		return flowDirection >= 0 ? phase - tileWidth : -phase;
	});

	return (
		<canvasgroup
			key="Fill"
			BackgroundTransparency={1}
			Position={UDim2.fromScale(art.fillLeft, art.fillTop)}
			Size={fraction.map((f) => UDim2.fromScale(fillWidth * math.max(f, MIN_FRACTION), fillHeight))}
			Visible={fraction.map((f) => f > MIN_FRACTION)}
			ZIndex={1}
		>
			<uicorner CornerRadius={new UDim(0.5, 0)} />
			<frame
				key="Full"
				BackgroundTransparency={1}
				Size={fraction.map((f) => UDim2.fromScale(1 / math.max(f, MIN_FRACTION), 1))}
			>
				<imagelabel
					key="Liquid"
					BackgroundTransparency={1}
					Image={art.flowTile}
					ScaleType={Enum.ScaleType.Tile}
					TileSize={UDim2.fromScale(tileWidth / labelWidth, 1)}
					Position={offset.map((x) => UDim2.fromScale(x, 0))}
					Size={UDim2.fromScale(labelWidth, 1)}
				/>
			</frame>
		</canvasgroup>
	);
}

/**
 * Auxiliary / Stamina tube: back, glass, liquid (flowing once its tile is
 * uploaded, otherwise the still fill), and brass dividers marking each point.
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

	const tile = art.flowTile;
	return (
		<frame key={name} BackgroundTransparency={1} {...place(piece)}>
			{layer("Back", art.back, -1)}
			{layer("Glass", art.glass, 0)}
			{tile !== undefined ? (
				<FlowingFill
					fraction={smoothed}
					art={{ ...art, flowTile: tile }}
					barAspect={piece.aspect}
					barWidthHw={piece.width}
					flowDirection={flowDirection}
				/>
			) : (
				<ClippedFill fraction={smoothed} insetLeft={art.fillLeft} insetWidth={fillWidth} zIndex={1}>
					{layer("Fill", art.fill, 1)}
				</ClippedFill>
			)}
			{dividers}
		</frame>
	);
}
