import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { applyRemote, mergeSnapshot, type RemoteChange } from './applyRemote';
import type { Card, CardsState } from './types';

export function useCards(userId: string) {
  const [cards, setCards] = useState<CardsState>({});
  const [online, setOnline] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lockRef = useRef<string | null>(null);
  const pendingRef = useRef(new Set<string>()); // insert 응답 전인 내 새 카드

  const reload = useCallback(async () => {
    const { data, error } = await supabase.from('cards').select('*');
    if (error) return setError('불러오기 실패');
    setCards(s => mergeSnapshot(data as Card[], s, pendingRef.current));
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('cards')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cards' },
        payload => setCards(s => applyRemote(s, payload as unknown as RemoteChange, lockRef.current)))
      .subscribe(status => {
        setOnline(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') reload(); // 최초 로드 + 재연결 시 전체 재로드
      });
    return () => { supabase.removeChannel(channel); };
  }, [reload]);

  // 낙관적으로 이미 반영된 쓰기. 실패하면 토스트 + 서버 값으로 되돌림
  const run = useCallback(async (op: PromiseLike<{ error: unknown }>) => {
    const { error } = await op;
    if (error) {
      setError('저장 실패, 다시 시도해 주세요');
      reload();
    }
  }, [reload]);

  const create = useCallback((x: number, y: number, sortOrder: number): string => {
    const now = new Date().toISOString();
    const card: Card = {
      id: crypto.randomUUID(), text: '', url: null, done: false, x, y,
      sort_order: sortOrder, author_id: userId, created_at: now, updated_at: now,
    };
    setCards(s => ({ ...s, [card.id]: card }));
    pendingRef.current.add(card.id);
    run(supabase.from('cards').insert(card)).finally(() => pendingRef.current.delete(card.id));
    return card.id;
  }, [userId, run]);

  const update = useCallback((id: string, patch: Partial<Card>) => {
    setCards(s => (s[id] ? { ...s, [id]: { ...s[id], ...patch } } : s));
    run(supabase.from('cards').update(patch).eq('id', id));
  }, [run]);

  const remove = useCallback((id: string) => {
    setCards(s => {
      const next = { ...s };
      delete next[id];
      return next;
    });
    run(supabase.from('cards').delete().eq('id', id));
  }, [run]);

  const setDragging = useCallback((id: string | null) => { lockRef.current = id; }, []);
  const clearError = useCallback(() => setError(null), []);

  return { cards, online, error, clearError, create, update, remove, setDragging };
}
