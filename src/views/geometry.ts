export type View = { x: number; y: number; scale: number };

export const CARD_W = 160;
export const MIN_SCALE = 0.25;
export const MAX_SCALE = 2;

export function screenToCanvas(v: View, sx: number, sy: number) {
  return { x: (sx - v.x) / v.scale, y: (sy - v.y) / v.scale };
}

// 화면의 (sx, sy) 지점을 고정한 채 확대/축소
export function zoomAt(v: View, sx: number, sy: number, factor: number): View {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor));
  const p = screenToCanvas(v, sx, sy);
  return { x: sx - p.x * scale, y: sy - p.y * scale, scale };
}

export const isDrag = (dx: number, dy: number) => Math.hypot(dx, dy) > 6;
