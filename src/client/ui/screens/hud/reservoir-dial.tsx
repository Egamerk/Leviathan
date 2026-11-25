import React, { type Binding, useEffect, useState } from "@rbxts/react";
import { ContentProvider } from "@rbxts/services";
import { vitalsAtom } from "client/store";
import { localStatsAtom } from "client/store/stats";
import { useAnimationClock } from "client/ui/hooks/use-animation-clock";
import { useAtom } from "client/ui/hooks/use-atom";
import { useSmoothedNumber } from "client/ui/hooks/use-smoothed-number";
import {
	HudAnimation,
	HudArt,
	HudPieces,
	RESERVOIR_ARC_DEGREES,
	RESERVOIR_CHAMBER_CUT,
	ReservoirBridge,
} from "./hud.config";
import { place, rect } from "./hud.layout";

const ART = HudArt.reservoir;
const GAUGE = ART.gauge;
const BRIDGE = ART.bridge;
/**
 * The swirl texture (its spin is clearly visible) once it has loaded, else the
 * original disc. Falls back if the swirl fails, e.g. while it's in moderation.
 */
function useDiscImage(): string {
	const swirl = ART.swirl;
	const [image, setImage] = useState<string>(ART.core);
	useEffect(() => {
		if (swirl === undefined) return;
		let alive = true;
		// Preload through an ImageLabel: a bare id string can't be preloaded as an image.
		const probe = new Instance("ImageLabel");
		probe.Image = swirl;
		task.spawn(() => {
			ContentProvider.PreloadAsync([probe], (_, status) => {
				if (alive && status === Enum.AssetFetchStatus.Success) setImage(swirl);
			});
			probe.Destroy();
		});
		return () => {
			alive = false;
		};
	}, []);
	return image;
}

/** Hard-edged half: visible where the gradient position is below 0.5. */
const HALF = new NumberSequence([
	new NumberSequenceKeypoint(0, 0),
	new NumberSequenceKeypoint(0.5, 0),
	new NumberSequenceKeypoint(0.501, 1),
	new NumberSequenceKeypoint(1, 1),
]);

/**
 * Angles are screen degrees: 0 = right, 90 = down (clockwise, like Roblox
 * Rotation). The arc starts just under the bridge plate on the left and
 * sweeps down through the bottom to the right, so slices read left → right.
 */
const ARC_START = 90 + RESERVOIR_ARC_DEGREES / 2;

/**
 * One slice of the disc between screen angles [from, to] (span < 180°). It's
 * the intersection of two half-planes:
 *  - the CanvasGroup's gradient keeps the side clockwise of `from`
 *  - the disc image's gradient keeps the side counter-clockwise of `to`
 *    (compensated for the disc's spin, since a gradient turns with its image).
 * GroupTransparency fades a partly filled slice.
 */
function Slice(props: { from: number; to: number; fill: Binding<number>; spin: Binding<number>; image: string }) {
	const { from, to, fill, spin, image } = props;
	return (
		<canvasgroup
			BackgroundTransparency={1}
			Size={UDim2.fromScale(1, 1)}
			GroupTransparency={fill.map((f) => 1 - f)}
			Visible={fill.map((f) => f > 0.001)}
			ZIndex={2}
		>
			<uigradient Transparency={HALF} Rotation={from - 90} />
			<imagelabel BackgroundTransparency={1} Image={image} Rotation={spin} Size={UDim2.fromScale(1, 1)}>
				<uigradient Transparency={HALF} Rotation={spin.map((r) => to + 90 - r)} />
			</imagelabel>
		</canvasgroup>
	);
}

/**
 * A spoke from the disc centre toward the rim at screen angle `angle`: a
 * centred bar one diameter long whose lower half is hidden by a gradient
 * (so it rotates about the disc centre), drawn as a dark outline under a
 * brass line.
 */
function Spoke({ angle, core }: { angle: number; core: ReturnType<typeof rect> }) {
	const line = (key: string, width: number, color: Color3, zIndex: number) => (
		<frame
			key={key}
			AnchorPoint={new Vector2(0.5, 0.5)}
			BackgroundColor3={color}
			BorderSizePixel={0}
			Position={UDim2.fromScale(core.x, core.y)}
			Rotation={angle + 90}
			Size={UDim2.fromScale(core.width * width, core.height * GAUGE.spokeLength)}
			ZIndex={zIndex}
		>
			<uigradient Transparency={HALF} Rotation={90} />
		</frame>
	);
	return (
		<>
			{line("Outline", GAUGE.spokeOutlineWidth, GAUGE.spokeOutline, -3)}
			{line("Brass", GAUGE.spokeWidth, GAUGE.spokeColor, -3)}
		</>
	);
}

/** Brass plate over the top of the chamber: shaded brass, dark outline, two rivets. */
function BridgePlate() {
	const rivet = (key: string, x: number) => (
		<frame
			key={key}
			AnchorPoint={new Vector2(0.5, 0.5)}
			BackgroundColor3={BRIDGE.rivet}
			BorderSizePixel={0}
			Position={UDim2.fromScale(x, 0.55)}
			Size={UDim2.fromScale(1, 0.38)}
		>
			<uiaspectratioconstraint AspectRatio={1} />
			<uicorner CornerRadius={new UDim(1, 0)} />
			<uistroke Color={BRIDGE.outline} Thickness={1} />
			<frame
				key="Shine"
				BackgroundColor3={BRIDGE.rivetHighlight}
				BorderSizePixel={0}
				Position={UDim2.fromScale(0.18, 0.18)}
				Size={UDim2.fromScale(0.4, 0.4)}
			>
				<uicorner CornerRadius={new UDim(1, 0)} />
			</frame>
		</frame>
	);
	return (
		<frame
			key="ReservoirBridge"
			BackgroundColor3={new Color3(1, 1, 1)}
			BorderSizePixel={0}
			ZIndex={-2}
			{...place(ReservoirBridge)}
		>
			<uigradient Color={new ColorSequence(BRIDGE.light, BRIDGE.dark)} Rotation={90} />
			<uistroke Color={BRIDGE.outline} Thickness={1.5} />
			{rivet("RivetLeft", 0.25)}
			{rivet("RivetRight", 0.75)}
		</frame>
	);
}

/**
 * Centre dial: brass holder, the purple Reservoir, the bridge plate and the brass ring.
 *
 * - Unlocked: an arc gauge with one slice per Reservoir point (brass spokes
 *   between them). Full slices show the bright spinning liquid, empty ones a
 *   dim version, and a partial slice fades in by how full it is. An occult
 *   rune ring turns slowly against the swirl.
 * - Locked: the whole chamber shows dimmed, slow-turning liquid (dormant).
 */
export function ReservoirDial({ hovered = false }: { hovered?: boolean }) {
	const glow = useSmoothedNumber(hovered ? 1 : 0, HudArt.hover.speed);
	const clock = useAnimationClock();
	const stats = useAtom(localStatsAtom);
	const vitals = useAtom(vitalsAtom);
	const unlocked = stats?.hasReservoir === true;
	const spinSpeed =
		HudAnimation.reservoirSpinDegreesPerSecond * (unlocked ? 1 : HudAnimation.reservoirDormantSpinFactor);
	const spin = clock.map((t) => (ART.coreRotation + t * spinSpeed) % 360);
	const core = rect(HudPieces.core);
	const disc = useDiscImage();

	const max = unlocked ? stats!.maxReservoir : 0;
	const slices = math.max(1, math.round(max));
	const perSlice = max / slices;
	const sliceSpan = RESERVOIR_ARC_DEGREES / slices;
	const current = useSmoothedNumber(vitals?.reservoir ?? 0, HudAnimation.barSmoothing);

	const gauge = new Array<React.Element>();
	const spokes = new Array<React.Element>();
	if (unlocked) {
		for (let k = 0; k < slices; k++) {
			const fill = current.map((c) => math.clamp((c - k * perSlice) / perSlice, 0, 1));
			gauge.push(
				<Slice
					key={`Slice${k}`}
					from={ARC_START - (k + 1) * sliceSpan}
					to={ARC_START - k * sliceSpan}
					fill={fill}
					spin={spin}
					image={disc}
				/>,
			);
		}
		for (let k = 0; k <= slices; k++) {
			spokes.push(<Spoke key={`Spoke${k}`} angle={ARC_START - k * sliceSpan} core={core} />);
		}
	}

	return (
		<>
			<imagelabel
				key="ReservoirHolder"
				BackgroundTransparency={1}
				Image={ART.holder}
				ZIndex={-7}
				{...place(HudPieces.holder)}
			/>
			{/* The chamber: everything above the bridge plate's bottom edge is cut away. */}
			<canvasgroup key="ReservoirChamber" BackgroundTransparency={1} ZIndex={-6} {...place(HudPieces.core)}>
				<uigradient
					Rotation={90}
					Transparency={
						new NumberSequence([
							new NumberSequenceKeypoint(0, 1),
							new NumberSequenceKeypoint(RESERVOIR_CHAMBER_CUT, 1),
							new NumberSequenceKeypoint(math.min(RESERVOIR_CHAMBER_CUT + 0.002, 1), 0),
							new NumberSequenceKeypoint(1, 0),
						])
					}
				/>
				<imagelabel
					key="Base"
					BackgroundTransparency={1}
					Image={disc}
					ImageColor3={unlocked ? GAUGE.emptyTint : ART.dormantTint}
					ImageTransparency={unlocked ? GAUGE.emptyTransparency : ART.dormantTransparency}
					Rotation={spin}
					Size={UDim2.fromScale(1, 1)}
					ZIndex={1}
				/>
				{gauge}
				{unlocked && ART.runes !== undefined && (
					<imagelabel
						key="Runes"
						BackgroundTransparency={1}
						Image={ART.runes}
						ImageTransparency={ART.runesTransparency}
						Rotation={clock.map((t) => (t * ART.runesSpinDegreesPerSecond) % 360)}
						Size={UDim2.fromScale(1, 1)}
						ZIndex={3}
					/>
				)}
			</canvasgroup>
			{spokes}
			<BridgePlate />
			{/* Hover feedback: a soft glow ring just outside the brass ring. */}
			<frame
				key="HoverGlow"
				AnchorPoint={new Vector2(0.5, 0.5)}
				BackgroundTransparency={1}
				Position={UDim2.fromScale(core.x, core.y)}
				Size={UDim2.fromScale(core.width * 1.12, core.height * 1.12)}
				Visible={glow.map((g) => g > 0.01)}
				ZIndex={0}
			>
				<uicorner CornerRadius={new UDim(1, 0)} />
				<uistroke Color={HudArt.hover.dialGlow} Thickness={2.5} Transparency={glow.map((g) => 1 - g * 0.85)} />
			</frame>
			<imagelabel
				key="ReservoirWheel"
				BackgroundTransparency={1}
				Image={ART.wheel}
				ZIndex={-1}
				{...place(HudPieces.wheel)}
			/>
		</>
	);
}
