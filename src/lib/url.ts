// 입력값을 열 수 있는 http(s) URL로. 비었거나 다른 스킴(javascript: 등)이면 null
export function normalizeUrl(input: string | null): string | null {
  const s = input?.trim();
  if (!s) return null;
  const withScheme = /^[a-z][a-z\d+.-]*:/i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}
