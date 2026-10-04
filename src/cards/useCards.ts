import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { applyRemote, mergeSnapshot, type RemoteChange } from './applyRemote';
import { dropLinksOf, type LinkAction } from './links';
import type { Card, CardsState, Link, LinksState } from './types';

export function useCards(userId: string) {
  const [cards, setCards] = useState<CardsState>({});
  const [links, setLinks] = useState<LinksState>({});
  const [online, setOnline] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lockRef = useRef<string | null>(null);
  const pendingRef = useRef(new Set<string>()); // insert 응답 전인 내 새 카드/연결

  const reload = useCallback(async () => {
    const [c, l] = await Promise.all([supabase.from('cards').select('*'), supabase.from('links').select('*')]);
    if (c.error || l.error) return setError('불러오기 실패');
    setCards(s => mergeSnapshot(c.data as Card[], s, pendingRef.current));
    setLinks(s => mergeSnapshot(l.data as Link[], s, pendingRef.current));
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('cards')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cards' },
        payload => setCards(s => applyRemote(s, payload as unknown as RemoteChange<Card>, lockRef.current)))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'links' },
        payload => setLinks(s => applyRemote(s, payload as unknown as RemoteChange<Link>, null)))
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
      id: crypto.randomUUID(), text: '', url: null, color: null, done: false, x, y,
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
    setLinks(s => dropLinksOf(s, id));
    run(supabase.from('cards').delete().eq('id', id));
  }, [run]);

  const applyLink = useCallback((action: LinkAction) => {
    if (action.kind === 'add') {
      const link: Link = { id: crypto.randomUUID(), from_id: action.from_id, to_id: action.to_id,
        style: action.style, created_at: new Date().toISOString() };
      setLinks(s => ({ ...s, [link.id]: link }));
      pendingRef.current.add(link.id);
      run(supabase.from('links').insert(link)).finally(() => pendingRef.current.delete(link.id));
    } else if (action.kind === 'update') {
      setLinks(s => (s[action.id] ? { ...s, [action.id]: { ...s[action.id], style: action.style } } : s));
      run(supabase.from('links').update({ style: action.style }).eq('id', action.id));
    } else {
      setLinks(s => {
        const next = { ...s };
        delete next[action.id];
        return next;
      });
      run(supabase.from('links').delete().eq('id', action.id));
    }
  }, [run]);

  const setDragging = useCallback((id: string | null) => { lockRef.current = id; }, []);
  const clearError = useCallback(() => setError(null), []);

  return { cards, links, online, error, clearError, create, update, remove, applyLink, setDragging };
}
