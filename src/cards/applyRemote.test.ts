import { describe, it, expect } from 'vitest';
import { applyRemote } from './applyRemote';
import type { Card, CardsState } from './types';

const card = (id: string, text = ''): Card => ({
  id, text, url: null, done: false, x: 0, y: 0, sort_order: 0,
  author_id: 'u', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
});
const state: CardsState = { a: card('a', 'old'), b: card('b') };

describe('applyRemote', () => {
  it('INSERT는 카드를 추가', () => {
    expect(applyRemote(state, { eventType: 'INSERT', new: card('c') }, null).c).toEqual(card('c'));
  });
  it('UPDATE는 카드를 교체', () => {
    expect(applyRemote(state, { eventType: 'UPDATE', new: card('a', 'new') }, null).a.text).toBe('new');
  });
  it('DELETE는 카드를 제거', () => {
    expect(applyRemote(state, { eventType: 'DELETE', old: { id: 'a' } }, null)).not.toHaveProperty('a');
  });
  it('드래그 중인 카드의 원격 UPDATE는 무시 (손가락 밑에서 튀지 않게)', () => {
    expect(applyRemote(state, { eventType: 'UPDATE', new: card('a', 'new') }, 'a')).toBe(state);
  });
  it('드래그·편집 중이어도 원격 DELETE는 반영', () => {
    expect(applyRemote(state, { eventType: 'DELETE', old: { id: 'a' } }, 'a')).not.toHaveProperty('a');
  });
  it('원본 상태를 변경하지 않음', () => {
    applyRemote(state, { eventType: 'DELETE', old: { id: 'b' } }, null);
    expect(state).toHaveProperty('b');
  });
});
