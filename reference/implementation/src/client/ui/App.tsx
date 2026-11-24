import React, { useEffect, useState } from "@rbxts/react";
import { sendEndTurn, sendRecover } from "client/controllers/encounter";
import {
	type ClientCombatant,
	combatants,
	gameMode,
	lastResult,
	qte,
	selectedAbility,
	suspicion,
	toast,
	turn,
	turnOrder,
} from "client/store";
import { getAbility } from "shared/data/abilities";
import { now } from "shared/util/clock";
import { useAtom } from "./useAtom";

/**
 * Placeholder HUD. Deliberately plain: it proves the data flow
 * (server events → atoms → UI) so the real art-directed UI can replace it piece by piece.
 */

const FONT = Enum.Font.GothamMedium;
const PANEL = Color3.fromRGB(12, 20, 28);
const ACCENT = Color3.fromRGB(80, 200, 255);

function Label(props: {
	text: string;
	size?: UDim2;
	position?: UDim2;
	color?: Color3;
	textSize?: number;
	anchor?: Vector2;
}) {
	return (
		<textlabel
			BackgroundTransparency={1}
			Text={props.text}
			Font={FONT}
			TextSize={props.textSize ?? 16}
			TextColor3={props.color ?? Color3.fromRGB(230, 240, 245)}
			Size={props.size ?? new UDim2(1, 0, 0, 20)}
			Position={props.position}
			AnchorPoint={props.anchor}
			TextXAlignment={Enum.TextXAlignment.Left}
		/>
	);
}

function Bar(props: { label: string; current: number; max: number; color: Color3; order: number }) {
	const fraction = props.max > 0 ? math.clamp(props.current / props.max, 0, 1) : 0;
	return (
		<frame
			BackgroundColor3={Color3.fromRGB(30, 40, 50)}
			BorderSizePixel={0}
			Size={new UDim2(1, 0, 0, 18)}
			LayoutOrder={props.order}
		>
			<frame BackgroundColor3={props.color} BorderSizePixel={0} Size={new UDim2(fraction, 0, 1, 0)} />
			<Label
				text={`  ${props.label} ${string.format("%.2f", props.current)} / ${props.max}`}
				size={new UDim2(1, 0, 1, 0)}
				textSize={13}
			/>
		</frame>
	);
}

function TurnOrder() {
	const order = useAtom(turnOrder);
	const all = useAtom(combatants);
	const current = useAtom(turn);
	return (
		<frame
			BackgroundTransparency={1}
			Size={new UDim2(0, 600, 0, 34)}
			Position={new UDim2(0.5, 0, 0, 12)}
			AnchorPoint={new Vector2(0.5, 0)}
		>
			<uilistlayout
				FillDirection={Enum.FillDirection.Horizontal}
				HorizontalAlignment={Enum.HorizontalAlignment.Center}
				Padding={new UDim(0, 6)}
				SortOrder={Enum.SortOrder.LayoutOrder}
			/>
			{order.map((id, index) => {
				const c = all.get(id);
				if (c === undefined) return undefined;
				const active = current?.actorId === id;
				return (
					<textlabel
						key={id}
						LayoutOrder={index}
						Size={new UDim2(0, 96, 1, 0)}
						BackgroundColor3={
							c.side === "diver" ? Color3.fromRGB(30, 70, 100) : Color3.fromRGB(100, 35, 35)
						}
						BackgroundTransparency={c.condition === "active" ? 0.1 : 0.7}
						BorderSizePixel={0}
						Font={FONT}
						TextSize={13}
						TextColor3={active ? ACCENT : Color3.fromRGB(230, 230, 230)}
						Text={`${active ? "▶ " : ""}${c.name}`}
					>
						<uistroke Color={ACCENT} Thickness={active ? 2 : 0} />
					</textlabel>
				);
			})}
		</frame>
	);
}

function ActionBar(props: { me: ClientCombatant }) {
	const current = useAtom(turn);
	const selected = useAtom(selectedAbility);
	const myTurn = current?.actorId === props.me.id;

	const button = (
		key: string,
		text: string,
		enabled: boolean,
		highlighted: boolean,
		onClick: () => void,
		order: number,
	) => (
		<textbutton
			key={key}
			LayoutOrder={order}
			Size={new UDim2(0, 120, 0, 40)}
			BackgroundColor3={highlighted ? Color3.fromRGB(30, 90, 120) : PANEL}
			AutoButtonColor={enabled}
			BorderSizePixel={0}
			Font={FONT}
			TextSize={14}
			TextColor3={enabled ? Color3.fromRGB(235, 245, 250) : Color3.fromRGB(110, 120, 130)}
			Text={text}
			Event={{ Activated: () => enabled && onClick() }}
		/>
	);

	return (
		<frame
			BackgroundTransparency={1}
			Size={new UDim2(0, 700, 0, 40)}
			Position={new UDim2(0.5, 0, 1, -24)}
			AnchorPoint={new Vector2(0.5, 1)}
		>
			<uilistlayout
				FillDirection={Enum.FillDirection.Horizontal}
				HorizontalAlignment={Enum.HorizontalAlignment.Center}
				Padding={new UDim(0, 8)}
				SortOrder={Enum.SortOrder.LayoutOrder}
			/>
			{props.me.abilities.map((id, index) => {
				const ability = getAbility(id);
				const cost = ability?.cost.stamina ?? 0;
				return button(
					id,
					`[${index + 1}] ${ability?.name ?? id} (${cost} St)`,
					myTurn,
					selected === id,
					() => selectedAbility(id),
					index,
				);
			})}
			{button("recover", "[R] Recover", myTurn && !current!.mainUsed, false, sendRecover, 10)}
			{button("end", "[Enter] End Turn", myTurn, false, sendEndTurn, 11)}
		</frame>
	);
}

function MyStatus(props: { me: ClientCombatant }) {
	const { me } = props;
	const current = useAtom(turn);
	const myTurn = current?.actorId === me.id;
	return (
		<frame
			BackgroundColor3={PANEL}
			BackgroundTransparency={0.15}
			BorderSizePixel={0}
			Size={new UDim2(0, 260, 0, 150)}
			Position={new UDim2(0, 16, 1, -16)}
			AnchorPoint={new Vector2(0, 1)}
		>
			<uipadding PaddingLeft={new UDim(0, 10)} PaddingRight={new UDim(0, 10)} PaddingTop={new UDim(0, 8)} />
			<uilistlayout Padding={new UDim(0, 5)} SortOrder={Enum.SortOrder.LayoutOrder} />
			<Label
				text={
					myTurn
						? `Your turn — Main: ${current!.mainUsed ? "used" : "ready"} · Move: ${current!.sideUsed ? "used" : "ready"}`
						: "Waiting…"
				}
				textSize={13}
			/>
			<Bar
				label="Health"
				current={me.health.current}
				max={me.health.max}
				color={Color3.fromRGB(190, 50, 60)}
				order={1}
			/>
			<Bar
				label="Stamina"
				current={me.stamina.current}
				max={me.stamina.max}
				color={Color3.fromRGB(220, 170, 60)}
				order={2}
			/>
			{me.reservoir && (
				<Bar
					label="Reservoir"
					current={me.reservoir.current}
					max={me.reservoir.max}
					color={Color3.fromRGB(120, 80, 200)}
					order={3}
				/>
			)}
			<Bar
				label="Auxiliary"
				current={me.auxiliary.current}
				max={me.auxiliary.max}
				color={Color3.fromRGB(80, 170, 140)}
				order={4}
			/>
		</frame>
	);
}

function QtePrompt() {
	const window = useAtom(qte);
	const [, setTick] = useState(0);
	useEffect(() => {
		if (window === undefined) return;
		const thread = task.spawn(() => {
			// eslint-disable-next-line no-constant-condition
			while (true) {
				task.wait();
				setTick((t) => t + 1);
			}
		});
		return () => task.cancel(thread);
	}, [window]);
	if (window === undefined) return undefined;

	const total = math.max(window.closesAt - (window.opensAt - 1), 0.01);
	const remaining = math.clamp((window.closesAt - now()) / total, 0, 1);
	const open = now() >= window.opensAt;
	const hint =
		window.kind === "Attack"
			? "Strike! W/A/S/D pick limb · Right Click = torso"
			: `${window.canParry ? "[F] Parry   " : ""}${window.canDodge ? "[Q]+[A/S/D] Dodge" : ""}`;

	return (
		<frame
			BackgroundColor3={PANEL}
			BackgroundTransparency={0.1}
			BorderSizePixel={0}
			Size={new UDim2(0, 380, 0, 70)}
			Position={new UDim2(0.5, 0, 0.62, 0)}
			AnchorPoint={new Vector2(0.5, 0.5)}
		>
			<Label
				text={window.sent ? "Input sent" : hint}
				position={new UDim2(0, 12, 0, 8)}
				size={new UDim2(1, -24, 0, 22)}
			/>
			<frame
				BackgroundColor3={Color3.fromRGB(40, 50, 60)}
				BorderSizePixel={0}
				Size={new UDim2(1, -24, 0, 14)}
				Position={new UDim2(0, 12, 0, 42)}
			>
				<frame
					BackgroundColor3={open ? Color3.fromRGB(255, 220, 90) : ACCENT}
					BorderSizePixel={0}
					Size={new UDim2(remaining, 0, 1, 0)}
				/>
			</frame>
		</frame>
	);
}

function Toast() {
	const text = useAtom(toast);
	const result = useAtom(lastResult);
	const shown = result ?? text;
	if (shown === undefined) return undefined;
	return (
		<Label
			text={shown}
			textSize={result ? 42 : 22}
			size={new UDim2(0, 600, 0, 50)}
			position={new UDim2(0.5, 0, 0.3, 0)}
			anchor={new Vector2(0.5, 0.5)}
		/>
	);
}

function Awareness() {
	const level = useAtom(suspicion);
	if (level <= 0) return undefined;
	const pursuing = level >= 1;
	return (
		<textlabel
			BackgroundTransparency={1}
			Size={new UDim2(0, 80, 0, 80)}
			Position={new UDim2(0.5, 0, 0.18, 0)}
			AnchorPoint={new Vector2(0.5, 0.5)}
			Text={pursuing ? "!" : "?"}
			Font={Enum.Font.GothamBlack}
			TextSize={64}
			TextColor3={pursuing ? Color3.fromRGB(255, 70, 70) : Color3.fromRGB(255, 220, 90)}
			TextTransparency={pursuing ? 0 : 1 - math.clamp(level, 0.2, 1)}
		/>
	);
}

export function App() {
	const mode = useAtom(gameMode);
	const all = useAtom(combatants);
	let me: ClientCombatant | undefined;
	for (const [, c] of all) if (c.isMe) me = c;

	return (
		<screengui ResetOnSpawn={false} IgnoreGuiInset={true} ZIndexBehavior={Enum.ZIndexBehavior.Sibling}>
			<Toast />
			{mode === "Explore" && <Awareness />}
			{mode === "Combat" && <TurnOrder />}
			{mode === "Combat" && me && <MyStatus me={me} />}
			{mode === "Combat" && me && <ActionBar me={me} />}
			<QtePrompt />
		</screengui>
	);
}
