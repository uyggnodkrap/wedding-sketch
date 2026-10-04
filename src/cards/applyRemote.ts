type Row = { id: string };

export type RemoteChange<T extends Row> =
  | { eventType: 'INSERT' | 'UPDATE'; new: T }
  | { eventType: 'DELETE'; old: { id: string } };

export function applyRemote<T extends Row>(
  state: Record<string, T>, change: RemoteChange<T>, lockedId: string | null,
): Record<string, T> {
  if (change.eventType === 'DELETE') {
    const next = { ...state };
    delete next[change.old.id];
    return next;
  }
  if (change.new.id === lockedId) return state;
  return { ...state, [change.new.id]: change.new };
}

// 서버 스냅샷으로 교체하되, 아직 저장 중인 내 새 레코드(pending)는 유지
export function mergeSnapshot<T extends Row>(
  server: T[], local: Record<string, T>, pending: ReadonlySet<string>,
): Record<string, T> {
  const next: Record<string, T> = Object.fromEntries(server.map(r => [r.id, r]));
  for (const id of pending) if (local[id] && !next[id]) next[id] = local[id];
  return next;
}
