import { HudPieces, type Piece } from "./hud.config";

/**
 * Converts the hw-based pieces in hud.config.ts into Scale UDim2s relative to
 * one cluster frame whose aspect ratio matches the pieces' combined bounds.
 */

const pieces: Piece[] = [];
for (const [, piece] of pairs(HudPieces)) pieces.push(piece);

let left = math.huge;
let top = math.huge;
let right = -math.huge;
let bottom = -math.huge;
for (const piece of pieces) {
	const halfW = piece.width / 2;
	const halfH = piece.width / piece.aspect / 2;
	left = math.min(left, piece.x - halfW);
	right = math.max(right, piece.x + halfW);
	top = math.min(top, piece.y - halfH);
	bottom = math.max(bottom, piece.y + halfH);
}

const CLUSTER_WIDTH = right - left;
const CLUSTER_HEIGHT = bottom - top;

/** Width ÷ height of the whole HUD cluster. */
export const CLUSTER_ASPECT = CLUSTER_WIDTH / CLUSTER_HEIGHT;

export interface Placement {
	AnchorPoint: Vector2;
	Position: UDim2;
	Size: UDim2;
}

/** A piece's centre and size as Scale of the cluster frame. */
export function rect(piece: Piece) {
	return {
		x: (piece.x - left) / CLUSTER_WIDTH,
		y: (piece.y - top) / CLUSTER_HEIGHT,
		width: piece.width / CLUSTER_WIDTH,
		height: piece.width / piece.aspect / CLUSTER_HEIGHT,
	};
}

/** Centre-anchored Position/Size for a piece, as Scale of the cluster frame. */
export function place(piece: Piece): Placement {
	const r = rect(piece);
	return {
		AnchorPoint: new Vector2(0.5, 0.5),
		Position: UDim2.fromScale(r.x, r.y),
		Size: UDim2.fromScale(r.width, r.height),
	};
}
