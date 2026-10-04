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
