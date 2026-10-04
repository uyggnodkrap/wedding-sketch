import { describe, it, expect } from 'vitest';
import { toggleLink, dropLinksOf } from './links';
import type { Link, LinksState } from './types';

const link = (id: string, from_id: string, to_id: string, style: Link['style'] = 'line'): Link =>
  ({ id, from_id, to_id, style, created_at: '2026-01-01T00:00:00Z' });

describe('toggleLink', () => {
  const links = [link('l1', 'a', 'b', 'line')];
  it('연결이 없으면 선택한 모양으로 추가', () =>
    expect(toggleLink(links, 'b', 'c', 'arrow')).toEqual({ kind: 'add', from_id: 'b', to_id: 'c', style: 'arrow' }));
  it('같은 방향 연결이 있고 모양이 다르면 모양 변경', () =>
    expect(toggleLink(links, 'a', 'b', 'arrow')).toEqual({ kind: 'update', id: 'l1', style: 'arrow' }));
  it('같은 방향 연결이 있고 모양도 같으면 삭제', () =>
    expect(toggleLink(links, 'a', 'b', 'line')).toEqual({ kind: 'remove', id: 'l1' }));
  it('반대 방향은 별개의 연결로 추가', () =>
    expect(toggleLink(links, 'b', 'a', 'line')).toEqual({ kind: 'add', from_id: 'b', to_id: 'a', style: 'line' }));
  it('자기 자신과는 연결하지 않음', () => expect(toggleLink(links, 'a', 'a', 'line')).toBeNull());
});

describe('dropLinksOf', () => {
  it('삭제된 카드에 붙은 연결(출발/도착)을 모두 제거', () => {
    const state: LinksState = { l1: link('l1', 'a', 'b'), l2: link('l2', 'c', 'a'), l3: link('l3', 'b', 'c') };
    expect(Object.keys(dropLinksOf(state, 'a'))).toEqual(['l3']);
  });
});
