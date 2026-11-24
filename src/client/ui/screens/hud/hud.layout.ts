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

/** Centre-anchored Position/Size for a piece, as Scale of the cluster frame. */
export function place(piece: Piece): Placement {
	return {
		AnchorPoint: new Vector2(0.5, 0.5),
		Position: UDim2.fromScale((piece.x - left) / CLUSTER_WIDTH, (piece.y - top) / CLUSTER_HEIGHT),
		Size: UDim2.fromScale(piece.width / CLUSTER_WIDTH, piece.width / piece.aspect / CLUSTER_HEIGHT),
	};
}
