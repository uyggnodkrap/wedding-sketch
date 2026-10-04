import type { Link, LinksState, LinkStyle } from './types';

export type LinkAction =
  | { kind: 'add'; from_id: string; to_id: string; style: LinkStyle }
  | { kind: 'update'; id: string; style: LinkStyle }
  | { kind: 'remove'; id: string };

// A→B를 선택한 모양으로 연결: 없으면 추가, 모양이 다르면 변경, 같으면 삭제. 자기 자신은 무시
export function toggleLink(links: Link[], from: string, to: string, style: LinkStyle): LinkAction | null {
  if (from === to) return null;
  const found = links.find(l => l.from_id === from && l.to_id === to);
  if (!found) return { kind: 'add', from_id: from, to_id: to, style };
  if (found.style !== style) return { kind: 'update', id: found.id, style };
  return { kind: 'remove', id: found.id };
}

// 카드 삭제 시 로컬에서 그 카드의 연결도 제거 (DB는 on delete cascade)
export function dropLinksOf(state: LinksState, cardId: string): LinksState {
  return Object.fromEntries(Object.entries(state).filter(([, l]) => l.from_id !== cardId && l.to_id !== cardId));
}
