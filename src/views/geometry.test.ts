import { describe, it, expect } from 'vitest';
import { screenToCanvas, zoomAt, isDrag, MAX_SCALE, MIN_SCALE } from './geometry';

const v = { x: 100, y: 50, scale: 2 };

describe('screenToCanvas', () => {
  it('pan과 scale을 되돌림', () => expect(screenToCanvas(v, 300, 250)).toEqual({ x: 100, y: 100 }));
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
