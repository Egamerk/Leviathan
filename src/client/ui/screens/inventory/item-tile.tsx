import React, { useEffect, useState } from "@rbxts/react";
import { FrameBorder, frameScale } from "./frame-border";
import { InventoryFonts, rarityOf } from "./inventory.config";

interface ToolLook {
	name: string;
	icon: string;
	quantity?: number;
	color?: Color3;
}

function readLook(tool: Tool): ToolLook {
	const quantity = tool.GetAttribute("Quantity");
	const color = tool.GetAttribute("Color");
	return {
		name: tool.Name,
		icon: tool.TextureId,
		quantity: typeIs(quantity, "number") ? quantity : undefined,
		color: typeIs(color, "Color3") ? color : undefined,
	};
}

/** Re-renders when the tool's name, icon or attributes change. */
function useToolLook(tool: Tool): ToolLook {
	const [look, setLook] = useState(() => readLook(tool));
	useEffect(() => {
		setLook(readLook(tool));
		const update = () => setLook(readLook(tool));
		const connections = [
			tool.AttributeChanged.Connect(update),
			tool.GetPropertyChangedSignal("Name").Connect(update),
			tool.GetPropertyChangedSignal("TextureId").Connect(update),
		];
		return () => connections.forEach((c) => c.Disconnect());
	}, [tool]);
	return look;
}

interface ItemTileProps {
	tool: Tool;
	equipped: boolean;
	onActivate: () => void;
	layoutOrder?: number;
	/** Small label above the tile (the hotbar key). */
	keyLabel?: string;
	/** Pixel offset upward (equipped hotbar slot). */
	lift?: number;
}

/** Name text height as a fraction of the tile, the same on every tile (like the reference). */
const NAME_TEXT = 0.19;

const BADGE_FILL = Color3.fromRGB(238, 232, 210);
const BADGE_EDGE = Color3.fromRGB(28, 28, 30);
const KEY_TEXT = Color3.fromRGB(225, 228, 230);
const EQUIPPED_TEXT = Color3.fromRGB(255, 244, 205);

function scale(color: Color3, by: number): Color3 {
	return new Color3(math.min(color.R * by, 1), math.min(color.G * by, 1), math.min(color.B * by, 1));
}

/**
 * One square item tile in the reference style: the rarity colour fills only
 * the inside of the frame art (so the frame's light band reads against the
 * panel behind it), the frame on top, then the icon or the name in a small
 * muted serif, and a cream count badge sitting on the bottom edge.
 */
export function ItemTile({ tool, equipped, onActivate, layoutOrder, keyLabel, lift = 0 }: ItemTileProps) {
	const look = useToolLook(tool);
	const rarity = rarityOf(tool);
	const [hovered, setHovered] = useState(false);
	const [size, setSize] = useState(0);
	const color = scale(look.color ?? rarity.color, equipped ? 1.1 : hovered ? 1.05 : 1);
	const textSize = math.max(math.floor(size * NAME_TEXT), 8);
	// Colour fills up to the border band's inner edge (1 px under it so no gap shows).
	const inset = math.max(math.floor(rarity.frame.inner * frameScale(rarity.frame, size)) - 1, 0);

	return (
		<frame
			BackgroundTransparency={1}
			LayoutOrder={layoutOrder}
			Size={UDim2.fromScale(1, 1)}
			Change={{ AbsoluteSize: (rbx) => setSize(rbx.AbsoluteSize.Y) }}
		>
			<uiaspectratioconstraint AspectRatio={1} />
			<imagebutton
				key="Tile"
				AutoButtonColor={false}
				BackgroundTransparency={1}
				Image=""
				Position={new UDim2(0, 0, 0, -lift)}
				Size={UDim2.fromScale(1, 1)}
				Event={{
					Activated: onActivate,
					MouseEnter: () => setHovered(true),
					MouseLeave: () => setHovered(false),
				}}
			>
				<frame
					key="Fill"
					BackgroundColor3={color}
					BorderSizePixel={0}
					Position={UDim2.fromOffset(inset, inset)}
					Size={new UDim2(1, -2 * inset, 1, -2 * inset)}
					ZIndex={1}
				>
					{/* Lit from above, slightly darker toward the bottom. */}
					<uigradient
						Color={new ColorSequence(new Color3(1, 1, 1), new Color3(0.84, 0.84, 0.84))}
						Rotation={90}
					/>
				</frame>
				<FrameBorder art={rarity.frame} tile={size} color={equipped ? EQUIPPED_TEXT : undefined} zIndex={2} />
				{look.icon !== "" ? (
					<imagelabel
						key="Icon"
						AnchorPoint={new Vector2(0.5, 0.5)}
						BackgroundTransparency={1}
						Image={look.icon}
						Position={UDim2.fromScale(0.5, 0.5)}
						Size={UDim2.fromScale(0.68, 0.68)}
						ScaleType={Enum.ScaleType.Fit}
						ZIndex={3}
					/>
				) : (
					<textlabel
						key="Name"
						AnchorPoint={new Vector2(0.5, 0.5)}
						BackgroundTransparency={1}
						FontFace={InventoryFonts.tile}
						LineHeight={0.9}
						Position={UDim2.fromScale(0.5, 0.48)}
						Size={UDim2.fromScale(0.8, 0.7)}
						Text={look.name}
						TextColor3={rarity.text}
						TextSize={textSize}
						TextTransparency={0.2}
						TextTruncate={Enum.TextTruncate.AtEnd}
						TextWrapped={true}
						ZIndex={3}
					/>
				)}
				{look.quantity !== undefined && (
					<frame
						key="Quantity"
						AnchorPoint={new Vector2(0.5, 0.5)}
						AutomaticSize={Enum.AutomaticSize.X}
						BackgroundColor3={BADGE_FILL}
						BorderSizePixel={0}
						Position={new UDim2(0.5, 0, 1, -inset)}
						Size={UDim2.fromScale(0, 0.16)}
						ZIndex={4}
					>
						<uistroke Color={BADGE_EDGE} Thickness={1} />
						<uipadding PaddingLeft={new UDim(0, 3)} PaddingRight={new UDim(0, 3)} />
						<textlabel
							AutomaticSize={Enum.AutomaticSize.X}
							BackgroundTransparency={1}
							FontFace={InventoryFonts.small}
							Size={UDim2.fromScale(0, 1)}
							Text={`x${look.quantity}`}
							TextColor3={BADGE_EDGE}
							TextSize={math.max(math.floor(size * 0.13), 6)}
							ZIndex={4}
						/>
					</frame>
				)}
			</imagebutton>
			{keyLabel !== undefined && (
				<textlabel
					key="Key"
					AnchorPoint={new Vector2(0.5, 1)}
					BackgroundTransparency={1}
					FontFace={InventoryFonts.small}
					Position={new UDim2(0.5, 0, 0, -2 - lift)}
					Size={UDim2.fromScale(0.4, 0.24)}
					Text={keyLabel}
					TextColor3={equipped ? EQUIPPED_TEXT : KEY_TEXT}
					TextScaled={true}
					TextStrokeTransparency={0.4}
				/>
			)}
		</frame>
	);
}
