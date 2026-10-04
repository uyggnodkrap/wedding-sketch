import type { Card } from './types';

const COLORS = ['#e0896f', '#7a9e8e'];

// ponytail: author_id 정렬 순서로 색 배정. 두 사람이 모두 카드를 쓰기 전엔 색이 한 번 바뀔 수 있음, 거슬리면 사용자별 색을 테이블에 저장
export function authorColors(cards: Card[]) {
  const ids = [...new Set(cards.map(c => c.author_id))].sort();
  return (authorId: string) => COLORS[ids.indexOf(authorId) % COLORS.length] ?? COLORS[0];
}
