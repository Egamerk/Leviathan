import React, { useEffect, useState } from "@rbxts/react";
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

/**
 * One square item tile: rarity colour, the rarity frame on top (its centre is
 * transparent), then the icon or the tool's name. Fills its parent's size.
 */
export function ItemTile({ tool, equipped, onActivate, layoutOrder, keyLabel, lift = 0 }: ItemTileProps) {
	const look = useToolLook(tool);
	const rarity = rarityOf(tool);
	const [hovered, setHovered] = useState(false);
	const color = look.color ?? rarity.color;
	const shade = equipped ? 1.12 : hovered ? 1.06 : 1;

	return (
		<frame BackgroundTransparency={1} LayoutOrder={layoutOrder} Size={UDim2.fromScale(1, 1)}>
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
				{/* Colour sits inside the border art so it never pokes out past its corners. */}
				<frame
					key="Fill"
					AnchorPoint={new Vector2(0.5, 0.5)}
					BackgroundColor3={
						new Color3(
							math.min(color.R * shade, 1),
							math.min(color.G * shade, 1),
							math.min(color.B * shade, 1),
						)
					}
					BorderSizePixel={0}
					Position={UDim2.fromScale(0.5, 0.5)}
					Size={UDim2.fromScale(0.95, 0.95)}
					ZIndex={1}
				>
					{equipped && (
						<uistroke
							key="EquippedGlow"
							Color={Color3.fromRGB(255, 244, 205)}
							Thickness={2}
							Transparency={0.15}
						/>
					)}
				</frame>
				<imagelabel
					key="Border"
					BackgroundTransparency={1}
					Image={rarity.frame}
					Size={UDim2.fromScale(1, 1)}
					ZIndex={2}
				/>
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
						Position={UDim2.fromScale(0.5, 0.5)}
						Size={UDim2.fromScale(0.78, 0.66)}
						Text={look.name}
						TextColor3={rarity.text}
						TextScaled={true}
						TextWrapped={true}
						ZIndex={3}
					>
						<uitextsizeconstraint MaxTextSize={18} MinTextSize={1} />
					</textlabel>
				)}
				{look.quantity !== undefined && (
					<frame
						key="Quantity"
						AnchorPoint={new Vector2(0.5, 0.5)}
						BackgroundColor3={Color3.fromRGB(30, 34, 38)}
						BorderSizePixel={0}
						Position={UDim2.fromScale(0.5, 0.93)}
						Size={UDim2.fromScale(0.44, 0.17)}
						ZIndex={4}
					>
						<uicorner CornerRadius={new UDim(0.25, 0)} />
						<uistroke Color={Color3.fromRGB(200, 190, 150)} Thickness={1} />
						<textlabel
							BackgroundTransparency={1}
							FontFace={InventoryFonts.small}
							Size={UDim2.fromScale(1, 1)}
							Text={`x${look.quantity}`}
							TextColor3={Color3.fromRGB(240, 232, 200)}
							TextScaled={true}
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
					TextColor3={equipped ? Color3.fromRGB(255, 244, 205) : Color3.fromRGB(225, 228, 230)}
					TextScaled={true}
					TextStrokeTransparency={0.4}
				/>
			)}
		</frame>
	);
}
