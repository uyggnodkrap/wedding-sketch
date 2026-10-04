// 입력을 모아 ms 동안 조용하면 한 번 저장. flush로 즉시 저장, cancel로 버림
export function createSaver<T extends object>(save: (patch: T) => void, ms = 500) {
  let pending: T | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const flush = () => {
    clearTimeout(timer);
    if (!pending) return;
    const patch = pending;
    pending = null;
    save(patch);
  };

  return {
    queue(patch: T) {
      pending = { ...pending, ...patch } as T;
      clearTimeout(timer);
      timer = setTimeout(flush, ms);
    },
    flush,
    cancel() {
      clearTimeout(timer);
      pending = null;
    },
  };
}
