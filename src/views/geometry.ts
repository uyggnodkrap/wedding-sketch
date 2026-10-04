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

// from 중심에서 to 중심으로 가는 선이 to 카드(반폭 hw, 반높이 hh) 테두리와 만나는 점과 진행 방향(도).
// 화살촉 끝을 여기에 둔다
export function arrowTip(from: { x: number; y: number }, to: { x: number; y: number }, hw: number, hh: number) {
  const dx = from.x - to.x;
  const dy = from.y - to.y;
  const t = Math.min(1, dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity);
  return { x: to.x + dx * t, y: to.y + dy * t, angle: Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI };
}

// 같은 대상을 ms 이내에 다시 탭했는지 (더블클릭/더블탭 공용)
export function isDoubleTap(prev: { id: string; t: number } | null, id: string, t: number, ms = 300): boolean {
  return prev !== null && prev.id === id && t - prev.t <= ms;
}
