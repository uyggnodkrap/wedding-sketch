import type { Card, CardsState } from './types';

export type RemoteChange =
  | { eventType: 'INSERT' | 'UPDATE'; new: Card }
  | { eventType: 'DELETE'; old: { id: string } };

export function applyRemote(state: CardsState, change: RemoteChange, lockedId: string | null): CardsState {
  if (change.eventType === 'DELETE') {
    const next = { ...state };
    delete next[change.old.id];
    return next;
  }
  if (change.new.id === lockedId) return state;
  return { ...state, [change.new.id]: change.new };
}

// 서버 스냅샷으로 교체하되, 아직 저장 중인 내 새 카드(pending)는 유지
export function mergeSnapshot(server: Card[], local: CardsState, pending: ReadonlySet<string>): CardsState {
  const next: CardsState = Object.fromEntries(server.map(c => [c.id, c]));
  for (const id of pending) if (local[id] && !next[id]) next[id] = local[id];
  return next;
}
