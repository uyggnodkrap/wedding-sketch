import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSaver } from './saver';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('createSaver', () => {
  it('연속 입력은 마지막 입력 후 한 번만, 병합해서 저장', () => {
    const save = vi.fn();
    const s = createSaver<{ text?: string; url?: string }>(save, 500);
    s.queue({ text: 'a' });
    vi.advanceTimersByTime(300);
    s.queue({ text: 'ab' });
    s.queue({ url: 'x' });
    vi.advanceTimersByTime(499);
    expect(save).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(save).toHaveBeenCalledExactlyOnceWith({ text: 'ab', url: 'x' });
  });
  it('flush는 대기 중인 입력을 즉시 저장 (시트를 바로 닫아도 유실 없음)', () => {
    const save = vi.fn();
    const s = createSaver<{ text?: string }>(save, 500);
    s.queue({ text: 'a' });
    s.flush();
    expect(save).toHaveBeenCalledExactlyOnceWith({ text: 'a' });
    vi.advanceTimersByTime(1000);
    expect(save).toHaveBeenCalledTimes(1);
  });
  it('대기 중인 입력이 없으면 flush는 아무것도 안 함', () => {
    const save = vi.fn();
    createSaver(save).flush();
    expect(save).not.toHaveBeenCalled();
  });
  it('cancel은 대기 중인 입력을 버림 (삭제 시)', () => {
    const save = vi.fn();
    const s = createSaver<{ text?: string }>(save, 500);
    s.queue({ text: 'a' });
    s.cancel();
    s.flush();
    vi.advanceTimersByTime(1000);
    expect(save).not.toHaveBeenCalled();
  });
});
