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

// 첫 손가락(주 포인터)의 터치/왼쪽 클릭만 제스처를 시작
export const startsGesture = (e: { isPrimary: boolean; button: number }) => e.isPrimary && e.button === 0;

// 선의 가운데 점과 진행 방향(도). 화살촉을 여기에 그린다
export function linkMid(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, angle: Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI };
}
