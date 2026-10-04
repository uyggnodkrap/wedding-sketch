import { describe, it, expect } from 'vitest';
import { normalizeUrl } from './url';

describe('normalizeUrl', () => {
  it('빈 값은 null', () => {
    expect(normalizeUrl('')).toBeNull();
    expect(normalizeUrl('   ')).toBeNull();
    expect(normalizeUrl(null)).toBeNull();
  });
  it('스킴이 없으면 https:// 를 붙임', () => {
    expect(normalizeUrl('instagram.com/p/abc')).toBe('https://instagram.com/p/abc');
  });
  it('http(s)는 그대로 (공백 제거)', () => {
    expect(normalizeUrl('  http://a.com/x  ')).toBe('http://a.com/x');
  });
  it('javascript: 등 다른 스킴은 거부', () => {
    expect(normalizeUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeUrl('data:text/html,hi')).toBeNull();
  });
});
