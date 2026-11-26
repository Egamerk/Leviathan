import React, { type Binding } from "@rbxts/react";
import { useAnimationClock } from "client/ui/hooks/use-animation-clock";
import { SlicedImage, slicedInset } from "client/ui/components/sliced-image";
import { useSmoothedNumber } from "client/ui/hooks/use-smoothed-number";
import { ArtAspect, HudAnimation, HudArt, type Piece } from "./hud.config";
import { place } from "./hud.layout";

export interface ResourceBarArt {
	back: string;
	glass: string;
	/**
	 * Side the liquid stays anchored to; it drains from the other end. At the
	 * brass cap the liquid end is cut square; at the rounded glass end it stays round.
	 */
	anchor: "left" | "right";
	/** Side of the brass cap (defaults to `anchor`). */
	cap?: "left" | "right";
	/**
	 * Darken the liquid as it drains: brightness at empty = 1 - darkenWhenLow
	 * (0 = never darkens, 0.5 = half as bright when nearly empty).
	 */
	darkenWhenLow?: number;
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
	/** Optional animated layer over the liquid (bubbles, embers, streaks…). */
	overlay?: LiquidOverlay;
	/**
	 * Width ÷ height of the tube art. When the piece is wider than this, the end
	 * caps (`sliceCap` of the art's width each) keep their shape and only the
	 * middle stretches.
	 */
	artAspect?: number;
	sliceCap?: number;
}

/**
 * A transparent texture, seamless in both directions and one liquid-height
 * tall, that moves over the liquid to show what the resource is.
 */
export interface LiquidOverlay {
	/** Unset (e.g. not uploaded yet) = no overlay. */
	image: string | undefined;
	/** Width ÷ height of the tile. */
	aspect: number;
	/** Speed in liquid heights per second: x > 0 moves right, y > 0 moves up. */
	velocityX: number;
	velocityY: number;
	/** Base transparency (0 = opaque). */
	transparency?: number;
	/** Extra transparency that flickers (0 = steady), e.g. for embers. */
	flicker?: number;
}

interface ResourceBarProps {
	name: string;
	fraction: number;
	/** Number of points (Auxiliary 2, Stamina 4…); a divider is drawn between each. */
	points: number;
	piece: Piece;
	art: ResourceBarArt;
	/** Sign: 1 = flows rightward, -1 = leftward. Size: multiple of the shared liquid speed (0.5 = half speed). */
	flowDirection: number;
	/** Hover feedback: the tube eases up in size. */
	hovered?: boolean;
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
	brightness = 1,
): ColorSequence {
	const pillWidth = level + overhang + extension;
	const o = overhang / pillWidth;
	const len = (SHADING.length * (1 / pillAspect)) / pillWidth;
	const capEdge = SHADING.shoulder * 0.97;
	// Anchor end: a cut edge at the cap (after the overhang), or a rounded end like the moving one.
	const knee: [number, number] = overhang > 0 ? [o, capEdge] : [0.3 * len, SHADING.shoulder];
	// Moving end: rounded, or cut straight when the pill extends past it (the extension is clipped).
	const e = extension / pillWidth;
	const tip: [number, number] = e > 0 ? [e, capEdge] : [0.3 * len, SHADING.shoulder];
	const raw: Array<[number, number]> = capOnLeft
		? [
				[0, SHADING.edge],
				[knee[0], knee[1]],
				[o + len, 1],
				[1 - e - len, 1],
				[1 - tip[0], tip[1]],
				[1, SHADING.edge],
			]
		: [
				[0, SHADING.edge],
				[tip[0], tip[1]],
				[e + len, 1],
				[1 - o - len, 1],
				[1 - knee[0], knee[1]],
				[1, SHADING.edge],
			];
	// Keypoint times must start at 0, end at 1 and strictly increase.
	const keypoints = new Array<ColorSequenceKeypoint>();
	let last = -1;
	for (const [t, v] of raw) {
		const time = keypoints.size() === 0 ? 0 : math.min(math.max(t, last + 1e-4), 1);
		if (time <= last) continue;
		const b = v * brightness;
		keypoints.push(new ColorSequenceKeypoint(time, new Color3(b, b, b)));
		last = time;
	}
	if (last < 1) {
		const b = SHADING.edge * brightness;
		keypoints.push(new ColorSequenceKeypoint(1, new Color3(b, b, b)));
	}
	return new ColorSequence(keypoints);
}

/**
 * Flowing liquid, anchored at one end and draining from the other.
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
	// Anchored at the cap: square end (pill overhangs the clip). At the glass end: round.
	const anchorAtCap = (art.cap ?? art.anchor) === art.anchor;
	// Anchored at the round glass end: the draining edge is always cut straight.
	const straightMovingEdge = !anchorAtCap;
	const darken = art.darkenWhenLow ?? 0;
	const fillWidth = art.fillRight - art.fillLeft;
	const fillHeight = art.fillBottom - art.fillTop;
	const pillAspect = (fillWidth * barAspect) / fillHeight; // fill box width ÷ height, in pixels
	// How far the pill extends past the cap edge, in fill-box widths (≥ its corner radius).
	const overhang = anchorAtCap ? 1 / pillAspect : 0;
	const radius = 1 / pillAspect;
	// Tile width in fill-box widths: the tile spans the box's height, keeping its aspect.
	const tileWidth = art.flowTileAspect / pillAspect;
	const labelWidth = 1 + tileWidth;
	// Shared on-screen speed (hw/s) converted to fill-box widths per second.
	// flowDirection's sign is the direction, its size a multiple of the shared speed.
	const speed = (HudAnimation.liquidSpeed * math.abs(flowDirection)) / (barWidthHw * fillWidth);
	const offset = clock.map((t) => {
		const phase = (t * speed) % tileWidth;
		return flowDirection >= 0 ? phase - tileWidth : -phase;
	});

	const level = fraction.map((f) => math.max(f, MIN_FRACTION));
	// Extra length past the moving edge (clipped away), so a far-end cap meets square liquid when full.
	const extensionAt = (f: number) =>
		straightMovingEdge ? radius : art.capsBothEnds ? radius * math.clamp((f - 0.95) / 0.05, 0, 1) : 0;
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
						Color={level.map((f) =>
							endShading(f, overhang, extensionAt(f), pillAspect, !fromRight, 1 - darken * (1 - f)),
						)}
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
						{art.overlay?.image !== undefined && (
							<Overlay
								clock={clock}
								overlay={art.overlay}
								image={art.overlay.image}
								pillAspect={pillAspect}
							/>
						)}
					</frame>
				</canvasgroup>
			</frame>
		</frame>
	);
}

/**
 * Overlay layer in fill-box units: one Tile-mode ImageLabel, one tile wider
 * and taller than the box, sliding by up to one tile in each direction, then
 * wrapping. Seamless because the tile wraps in both directions.
 */
function Overlay(props: { clock: Binding<number>; overlay: LiquidOverlay; image: string; pillAspect: number }) {
	const { clock, overlay, image, pillAspect } = props;
	const tileWidth = overlay.aspect / pillAspect; // fill-box widths (one tile is one box height tall)
	const labelWidth = 1 + tileWidth;
	const base = overlay.transparency ?? 0;
	const flicker = overlay.flicker ?? 0;
	return (
		<imagelabel
			key="Overlay"
			BackgroundTransparency={1}
			Image={image}
			ScaleType={Enum.ScaleType.Tile}
			TileSize={UDim2.fromScale(tileWidth / labelWidth, 0.5)}
			Position={clock.map((t) => {
				const side = ((((t * overlay.velocityX) / pillAspect) % tileWidth) + tileWidth) % tileWidth;
				const up = (((t * overlay.velocityY) % 1) + 1) % 1;
				return UDim2.fromScale(side - tileWidth, -up);
			})}
			ImageTransparency={clock.map((t) =>
				flicker > 0 ? base + flicker * (0.5 + 0.3 * math.sin(t * 9.1) + 0.2 * math.sin(t * 23.7)) : base,
			)}
			Size={UDim2.fromScale(labelWidth, 2)}
			ZIndex={2}
		/>
	);
}

/**
 * Auxiliary / Stamina tube: back, glass, flowing liquid anchored at one end,
 * and brass dividers marking each point.
 */
export function ResourceBar(props: ResourceBarProps) {
	const { name, fraction, points, piece, flowDirection, hovered = false } = props;
	// A widened tube: move the fill box's ends inward to where the (unstretched) caps now sit.
	const art =
		props.art.artAspect !== undefined
			? {
					...props.art,
					fillLeft: slicedInset(props.art.fillLeft, props.art.artAspect, piece.aspect),
					fillRight: 1 - slicedInset(1 - props.art.fillRight, props.art.artAspect, piece.aspect),
				}
			: props.art;
	const smoothed = useSmoothedNumber(fraction, HudAnimation.barSmoothing);
	const scale = useSmoothedNumber(hovered ? HudArt.hover.scale : 1, HudArt.hover.speed);
	const fillWidth = art.fillRight - art.fillLeft;
	// Divider box: its art is a thin line centred in a wide transparent image.
	const dividerHeight = DIVIDER.heightFraction;
	const dividerWidth = (dividerHeight * ArtAspect.divider) / piece.aspect;

	const layer = (key: string, image: string, zIndex: number) =>
		art.artAspect !== undefined ? (
			<frame key={key} BackgroundTransparency={1} Size={UDim2.fromScale(1, 1)} ZIndex={zIndex}>
				<SlicedImage
					image={image}
					artAspect={art.artAspect}
					boxAspect={piece.aspect}
					cap={art.sliceCap ?? 0.05}
					zIndex={zIndex}
				/>
			</frame>
		) : (
			<imagelabel
				key={key}
				BackgroundTransparency={1}
				Size={UDim2.fromScale(1, 1)}
				Image={image}
				ZIndex={zIndex}
			/>
		);

	const dividers = new Array<React.Element>();
	for (let k = 1; k < points; k++) {
		const x = art.fillLeft + (fillWidth * k) / points;
		dividers.push(
			<imagelabel
				key={`Divider${k}`}
				AnchorPoint={new Vector2(0.5, 0.5)}
				BackgroundTransparency={1}
				Position={UDim2.fromScale(x, 0.5)}
				Size={UDim2.fromScale(dividerWidth, dividerHeight)}
				Image={DIVIDER.image}
				ScaleType={Enum.ScaleType.Crop}
				ZIndex={2}
			/>,
		);
	}

	return (
		<frame key={name} BackgroundTransparency={1} {...place(piece)}>
			<uiscale Scale={scale} />
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
