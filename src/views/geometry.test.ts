import { describe, it, expect } from 'vitest';
import { screenToCanvas, zoomAt, centerOn, isDrag, startsGesture, arrowTip, isDoubleTap, MAX_SCALE, MIN_SCALE } from './geometry';

const v = { x: 100, y: 50, scale: 2 };

describe('screenToCanvas', () => {
  it('pan과 scale을 되돌림', () => expect(screenToCanvas(v, 300, 250)).toEqual({ x: 100, y: 100 }));
});

describe('centerOn', () => {
  it('캔버스 지점이 화면 중앙에 오고 배율은 유지', () => {
    const c = centerOn(v, 300, 120, 800, 600);
    expect(c.scale).toBe(v.scale);
    expect(screenToCanvas(c, 400, 300)).toEqual({ x: 300, y: 120 });
  });
});

describe('zoomAt', () => {
  it('기준 화면 지점의 캔버스 좌표가 유지됨', () => {
    const v1 = { x: 100, y: 50, scale: 1 };
    const z = zoomAt(v1, 200, 300, 1.25);
    expect(z.scale).toBe(1.25);
    const before = screenToCanvas(v1, 200, 300);
    const after = screenToCanvas(z, 200, 300);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });
  it('최대/최소 배율로 제한', () => {
    expect(zoomAt(v, 0, 0, 10).scale).toBe(MAX_SCALE);
    expect(zoomAt(v, 0, 0, 0.01).scale).toBe(MIN_SCALE);
  });
});

describe('isDrag', () => {
  it('6px 이하 이동은 탭', () => expect(isDrag(3, 3)).toBe(false));
  it('6px 초과 이동은 드래그', () => expect(isDrag(10, 0)).toBe(true));
});

describe('startsGesture', () => {
  it('첫 손가락 터치/왼쪽 클릭은 제스처 시작', () => expect(startsGesture({ isPrimary: true, button: 0 })).toBe(true));
  it('두 번째 손가락은 무시 (드래그 중 제스처가 덮어써지지 않게)', () =>
    expect(startsGesture({ isPrimary: false, button: 0 })).toBe(false));
  it('오른쪽 클릭은 무시', () => expect(startsGesture({ isPrimary: true, button: 2 })).toBe(false));
});

describe('arrowTip', () => {
  // 도착 카드: 중심 c, 반폭 80, 반높이 30
  it('가로: 도착 카드의 왼쪽 테두리에 붙음', () =>
    expect(arrowTip({ x: 0, y: 0 }, { x: 100, y: 0 }, 80, 30)).toEqual({ x: 20, y: 0, angle: 0 }));
  it('세로: 도착 카드의 위쪽 테두리에 붙음', () =>
    expect(arrowTip({ x: 0, y: 0 }, { x: 0, y: 100 }, 80, 30)).toEqual({ x: 0, y: 70, angle: 90 }));
  it('대각선: 먼저 만나는 테두리(위쪽)에 붙음', () => {
    const t = arrowTip({ x: 0, y: 0 }, { x: 100, y: 100 }, 80, 30);
    expect([t.x, t.y]).toEqual([70, 70]);
    expect(t.angle).toBeCloseTo(45);
  });
  it('카드가 겹쳐 출발점이 도착 카드 안이면 출발점에 둠', () =>
    expect(arrowTip({ x: 10, y: 0 }, { x: 0, y: 0 }, 80, 30)).toMatchObject({ x: 10, y: 0 }));
});

describe('isDoubleTap', () => {
  it('같은 대상을 300ms 이내에 다시 탭하면 더블탭', () => expect(isDoubleTap({ id: 'l1', t: 1000 }, 'l1', 1300)).toBe(true));
  it('간격이 300ms를 넘으면 아님', () => expect(isDoubleTap({ id: 'l1', t: 1000 }, 'l1', 1301)).toBe(false));
  it('다른 대상이면 아님', () => expect(isDoubleTap({ id: 'l1', t: 1000 }, 'l2', 1100)).toBe(false));
  it('이전 탭이 없으면 아님', () => expect(isDoubleTap(null, 'l1', 1000)).toBe(false));
});
