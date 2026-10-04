import { describe, it, expect } from 'vitest';
import { nextOrder, reorderedOrder, byOrder } from './order';
import type { Card } from '../cards/types';

const card = (id: string, sort_order: number, created_at = '2026-01-01T00:00:00Z'): Card => ({
  id, text: '', url: null, done: false, x: 0, y: 0, sort_order,
  color: null, author_id: 'u', created_at, updated_at: created_at,
});
const list = [card('a', 0), card('b', 1), card('c', 2)];

describe('nextOrder', () => {
  it('빈 보드면 0', () => expect(nextOrder([])).toBe(0));
  it('최댓값 + 1', () => expect(nextOrder(list)).toBe(3));
});

describe('reorderedOrder', () => {
  it('중간으로: c를 a와 b 사이로', () => expect(reorderedOrder(list, 2, 1)).toBe(0.5));
  it('아래로 한 칸: a를 b와 c 사이로', () => expect(reorderedOrder(list, 0, 1)).toBe(1.5));
  it('맨 앞으로: 첫 카드 - 1', () => expect(reorderedOrder(list, 2, 0)).toBe(-1));
  it('맨 뒤로: 마지막 카드 + 1', () => expect(reorderedOrder(list, 0, 2)).toBe(3));
  it('카드가 하나뿐이면 0', () => expect(reorderedOrder([card('a', 5)], 0, 0)).toBe(0));
});

describe('byOrder', () => {
  it('sort_order 오름차순', () => {
    expect([list[2], list[0], list[1]].sort(byOrder).map(c => c.id)).toEqual(['a', 'b', 'c']);
  });
  it('sort_order가 같으면 created_at 순 (동시 생성)', () => {
    const later = card('x', 1, '2026-01-02T00:00:00Z');
    const earlier = card('y', 1, '2026-01-01T00:00:00Z');
    expect([later, earlier].sort(byOrder).map(c => c.id)).toEqual(['y', 'x']);
  });
  it('sort_order, created_at이 모두 같으면 id 순', () => {
    expect([card('b', 1), card('a', 1)].sort(byOrder).map(c => c.id)).toEqual(['a', 'b']);
  });
});
