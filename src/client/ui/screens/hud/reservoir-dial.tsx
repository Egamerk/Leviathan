import React, { type Binding } from "@rbxts/react";
import { vitalsAtom } from "client/store";
import { localStatsAtom } from "client/store/stats";
import { useAnimationClock } from "client/ui/hooks/use-animation-clock";
import { useAtom } from "client/ui/hooks/use-atom";
import { useSmoothedNumber } from "client/ui/hooks/use-smoothed-number";
import { HudAnimation, HudArt, HudPieces, RESERVOIR_ARC_DEGREES, ReservoirBridge } from "./hud.config";
import { place, rect } from "./hud.layout";

const ART = HudArt.reservoir;
const GAUGE = ART.gauge;
const BRIDGE = ART.bridge;
/** The swirl texture when uploaded (its spin is clearly visible), else the original disc. */
const DISC = ART.swirl ?? ART.core;

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
function Slice(props: {
	from: number;
	to: number;
	fill: Binding<number>;
	spin: Binding<number>;
	core: ReturnType<typeof rect>;
}) {
	const { from, to, fill, spin, core } = props;
	return (
		<canvasgroup
			BackgroundTransparency={1}
			AnchorPoint={new Vector2(0.5, 0.5)}
			Position={UDim2.fromScale(core.x, core.y)}
			Size={UDim2.fromScale(core.width, core.height)}
			GroupTransparency={fill.map((f) => 1 - f)}
			Visible={fill.map((f) => f > 0.001)}
			ZIndex={-4}
		>
			<uigradient Transparency={HALF} Rotation={from - 90} />
			<imagelabel BackgroundTransparency={1} Image={DISC} Rotation={spin} Size={UDim2.fromScale(1, 1)}>
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
 *   dim version, and a partial slice fades in by how full it is.
 * - Locked: the whole chamber shows dimmed, slow-turning liquid (dormant).
 */
export function ReservoirDial() {
	const clock = useAnimationClock();
	const stats = useAtom(localStatsAtom);
	const vitals = useAtom(vitalsAtom);
	const unlocked = stats?.hasReservoir === true;
	const spinSpeed =
		HudAnimation.reservoirSpinDegreesPerSecond * (unlocked ? 1 : HudAnimation.reservoirDormantSpinFactor);
	const spin = clock.map((t) => (ART.coreRotation + t * spinSpeed) % 360);
	const core = rect(HudPieces.core);

	const max = unlocked ? stats!.maxReservoir : 0;
	const slices = math.max(1, math.round(max));
	const perSlice = max / slices;
	const sliceSpan = RESERVOIR_ARC_DEGREES / slices;
	const current = useSmoothedNumber(vitals?.reservoir ?? 0, HudAnimation.barSmoothing);

	const gauge = new Array<React.Element>();
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
					core={core}
				/>,
			);
		}
		for (let k = 0; k <= slices; k++) {
			gauge.push(<Spoke key={`Spoke${k}`} angle={ARC_START - k * sliceSpan} core={core} />);
		}
	}

	return (
		<>
			<imagelabel
				key="ReservoirHolder"
				BackgroundTransparency={1}
				Image={ART.holder}
				ZIndex={-6}
				{...place(HudPieces.holder)}
			/>
			<imagelabel
				key="ReservoirBase"
				BackgroundTransparency={1}
				Image={DISC}
				ImageColor3={unlocked ? GAUGE.emptyTint : ART.dormantTint}
				ImageTransparency={unlocked ? GAUGE.emptyTransparency : ART.dormantTransparency}
				Rotation={spin}
				ZIndex={-5}
				{...place(HudPieces.core)}
			/>
			{gauge}
			<BridgePlate />
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
