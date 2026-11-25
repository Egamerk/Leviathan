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
	/**
	 * The tube has a cap at the far end too (Oxygen). Near full, the liquid's
	 * moving end grows past the fill box so it meets that cap square instead
	 * of showing a rounded end against it.
	 */
	capsBothEnds?: boolean;
	/** Optional transparent layer (e.g. bubbles) tiled in both directions, rising over the liquid. */
	bubbles?: string;
	/** Width ÷ height of the bubble tile; one tile is one liquid-height tall. */
	bubblesAspect?: number;
	/** Rise speed in liquid heights per second, and sideways drift relative to it. */
	bubbleRise?: number;
	bubbleDrift?: number;
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
const SHADING = HudArt.liquidShading;
const MIN_FRACTION = 1e-3;

/**
 * Brightness along the pill (0 = left edge, 1 = right edge) so both visible
 * ends darken like the original fill art. The shading keeps a constant
 * physical length (in liquid heights) whatever the level. On the cap side it
 * starts where the clip cuts the pill (after the overhang).
 */
function endShading(
	level: number,
	overhang: number,
	extension: number,
	pillAspect: number,
	capOnLeft: boolean,
): ColorSequence {
	const pillWidth = level + overhang + extension;
	const o = overhang / pillWidth;
	const len = (SHADING.length * (1 / pillAspect)) / pillWidth;
	const capEdge = SHADING.shoulder * 0.97;
	const raw: Array<[number, number]> = capOnLeft
		? [
				[0, SHADING.edge],
				[o, capEdge],
				[o + len, 1],
				[1 - len, 1],
				[1 - 0.3 * len, SHADING.shoulder],
				[1, SHADING.edge],
			]
		: [
				[0, SHADING.edge],
				[0.3 * len, SHADING.shoulder],
				[len, 1],
				[1 - o - len, 1],
				[1 - o, capEdge],
				[1, SHADING.edge],
			];
	// Keypoint times must start at 0, end at 1 and strictly increase.
	const keypoints = new Array<ColorSequenceKeypoint>();
	let last = -1;
	for (const [t, v] of raw) {
		const time = keypoints.size() === 0 ? 0 : math.min(math.max(t, last + 1e-4), 1);
		if (time <= last) continue;
		keypoints.push(new ColorSequenceKeypoint(time, new Color3(v, v, v)));
		last = time;
	}
	if (last < 1) keypoints.push(new ColorSequenceKeypoint(1, new Color3(SHADING.edge, SHADING.edge, SHADING.edge)));
	return new ColorSequence(keypoints);
}

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
	// Extra length past the moving edge (clipped away), so a far-end cap meets square liquid when full.
	const extensionAt = (f: number) => (art.capsBothEnds ? overhang * math.clamp((f - 0.95) / 0.05, 0, 1) : 0);
	// Liquid (pill) extent in fill-box units: [start, start + width].
	const startAt = (f: number) => (fromRight ? 1 - f - extensionAt(f) : -overhang);
	const pillStart = level.map(startAt);
	const pillWidth = level.map((f) => f + overhang + extensionAt(f));

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
					<uigradient
						Color={level.map((f) => endShading(f, overhang, extensionAt(f), pillAspect, !fromRight))}
					/>
					<frame
						key="Tex"
						BackgroundTransparency={1}
						Position={level.map((f) => UDim2.fromScale(-startAt(f) / (f + overhang + extensionAt(f)), 0))}
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
						{art.bubbles !== undefined && (
							<Bubbles
								clock={clock}
								image={art.bubbles}
								aspect={art.bubblesAspect ?? 4}
								pillAspect={pillAspect}
								rise={art.bubbleRise ?? 0.35}
								drift={art.bubbleDrift ?? 0.25}
							/>
						)}
					</frame>
				</canvasgroup>
			</frame>
		</frame>
	);
}

/**
 * Bubble layer in fill-box units: one Tile-mode ImageLabel, one tile wider and
 * taller than the box, sliding up (and slightly sideways) by up to one tile,
 * then wrapping. Seamless because the bubble tile wraps in both directions.
 */
function Bubbles(props: {
	clock: Binding<number>;
	image: string;
	aspect: number;
	pillAspect: number;
	rise: number;
	drift: number;
}) {
	const { clock, image, aspect, pillAspect, rise, drift } = props;
	const tileWidth = aspect / pillAspect; // fill-box widths (one tile is one box height tall)
	const labelWidth = 1 + tileWidth;
	return (
		<imagelabel
			key="Bubbles"
			BackgroundTransparency={1}
			Image={image}
			ScaleType={Enum.ScaleType.Tile}
			TileSize={UDim2.fromScale(tileWidth / labelWidth, 0.5)}
			Position={clock.map((t) => {
				const up = (t * rise) % 1; // box heights
				const side = ((t * rise * drift) / pillAspect) % tileWidth; // box widths
				return UDim2.fromScale(side - tileWidth, -up);
			})}
			Size={UDim2.fromScale(labelWidth, 2)}
			ZIndex={2}
		/>
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
