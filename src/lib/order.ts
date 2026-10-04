import type { Card } from '../cards/types';

export function nextOrder(cards: Card[]): number {
  return cards.length ? Math.max(...cards.map(c => c.sort_order)) + 1 : 0;
}

// sorted[from] 카드를 to 위치로 옮겼을 때 그 카드의 새 sort_order. 다른 카드는 그대로 둔다.
export function reorderedOrder(sorted: Card[], from: number, to: number): number {
  const rest = sorted.filter((_, i) => i !== from);
  const before = rest[to - 1]?.sort_order;
  const after = rest[to]?.sort_order;
  if (before === undefined && after === undefined) return 0;
  if (before === undefined) return after! - 1;
  if (after === undefined) return before + 1;
  // ponytail: 같은 값 두 개 사이에 놓으면 평균도 같아 위치가 안 바뀜. 동시 생성 때만 생김, 문제 되면 전체 재번호 추가
  return (before + after) / 2;
}

export function byOrder(a: Card, b: Card): number {
  return a.sort_order - b.sort_order
    || a.created_at.localeCompare(b.created_at)
    || a.id.localeCompare(b.id);
}
