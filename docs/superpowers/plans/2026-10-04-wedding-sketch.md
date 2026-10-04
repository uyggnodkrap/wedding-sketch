# Wedding Sketch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 커플 두 사람이 폰/태블릿에서 결혼 준비 메모 카드를 자유 캔버스에 붙이고, 정리 모드에서 순서를 바꾸며, 실시간으로 공유하는 PWA를 만든다.

**Architecture:** React + Vite SPA가 Supabase(Postgres + Realtime + Google OAuth + RLS)에 직접 붙는다. 서버 코드는 없다. 상태는 `useCards` 훅 하나가 들고(초기 로드 → Realtime 구독 → 낙관적 쓰기), 캔버스/정리 두 보기가 같은 카드 배열을 다르게 그린다. 순수 로직(`sort_order` 계산, 원격 변경 반영, 좌표 변환, URL 정규화, 디바운스 저장)은 `src/lib`, `src/cards`에 분리해 Vitest로 검증한다.

**Tech Stack:** React 19, Vite, TypeScript, `@supabase/supabase-js`, `@dnd-kit/core`, `@dnd-kit/sortable`, Vitest

**Spec:** `docs/superpowers/specs/2026-10-04-wedding-sketch-design.md`

> **2026-10-04 변경:** 구현 후 로그인을 Google OAuth에서 이메일 6자리 코드(OTP)로 바꿨다. 아래 Task 2·3·8의 Google 관련 단계는 기록으로만 남긴다. 현재 설정 방법은 스펙 §5 로그인 참고.

## Global Constraints

- 허용된 구글 계정 2개 외에는 데이터를 볼 수 없다 — RLS로 서버에서 강제한다.
- 서버 코드 없음. 백엔드는 Supabase 대시보드 설정 + SQL 파일만.
- 런타임 의존성은 `@supabase/supabase-js`, `@dnd-kit/core`, `@dnd-kit/sortable`만, 개발 의존성은 `vitest`만 추가한다.
- 모든 UI 문구는 한국어.
- 캔버스 카드 드래그와 정리 모드 드래그는 터치(폰·태블릿)에서 동작해야 한다.
- 동시 편집은 last-write-wins.
- 스펙과의 차이 1건: `sort_order`는 `real` 대신 `double precision`. 평균으로 끼워 넣는 방식은 `real`(24비트)이면 같은 자리 20여 번 만에 정밀도가 바닥나기 때문.

## Review Focus

1. **동시 생성으로 `sort_order`가 같은 카드** — 두 사람이 동시에 새 카드를 만들면 같은 값이 생긴다. 정렬이 기기마다 달라지면 안 된다 → `byOrder`가 `created_at`, `id`로 동점 처리 (Task 1 테스트).
2. **링크에 스킴 없는 주소나 `javascript:` 입력** — `instagram.com/p/x`는 열려야 하고, `javascript:`는 절대 링크가 되면 안 된다 → `normalizeUrl` (Task 5 테스트).
3. **편집 중 시트를 바로 닫음** — 디바운스 대기 중인 입력이 사라지면 안 된다 → `createSaver().flush()`를 언마운트 시 호출 (Task 6 테스트).
4. **내가 드래그하는 카드를 상대가 동시에 옮김** — 카드가 손가락 밑에서 튀면 안 된다 → `applyRemote`가 잠긴 카드의 원격 UPDATE 무시 (Task 4 테스트).
5. **편집 중인 카드를 상대가 삭제** — 시트가 사라진 카드를 붙잡고 있으면 안 된다 → `applyRemote`가 잠금과 무관하게 DELETE 반영, App은 카드가 없으면 시트를 닫음 (Task 4 테스트 + Task 6 코드).

---

## File Structure

```
supabase/migrations/0001_init.sql   테이블, RLS, 트리거, Realtime publication
supabase/checks/rls_check.sql       미허용 계정 0건 확인
.env.example                        VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
index.html                          lang, title, manifest
public/manifest.webmanifest, public/icon.svg
src/main.tsx                        (템플릿 그대로)
src/index.css                       전체 스타일 (한 파일)
src/App.tsx                         AuthGate → Board (상단 바, 보기 전환, 토스트, 시트)
src/auth/AuthGate.tsx               로그인 / 접근 확인 / 로그아웃
src/lib/supabase.ts                 클라이언트 1개
src/lib/order.ts (+ .test.ts)       nextOrder, reorderedOrder, byOrder
src/lib/url.ts (+ .test.ts)         normalizeUrl
src/lib/saver.ts (+ .test.ts)       createSaver (디바운스 + flush)
src/cards/types.ts                  Card, CardsState
src/cards/applyRemote.ts (+ .test.ts)
src/cards/useCards.ts               로드, 구독, 낙관적 쓰기, 롤백
src/cards/authorColor.ts            작성자 → 색
src/cards/CardView.tsx              카드 표시 (두 보기 공용)
src/cards/EditSheet.tsx             하단 편집 시트
src/views/geometry.ts (+ .test.ts)  View, screenToCanvas, zoomAt, isDrag
src/views/CanvasView.tsx
src/views/ListView.tsx
```

---

### Task 1: 프로젝트 스캐폴드 + `sort_order` 로직

**Files:**
- Create: Vite react-ts 템플릿 전체, `src/cards/types.ts`, `src/lib/order.ts`
- Test: `src/lib/order.test.ts`

**Interfaces:**
- Produces:
  - `type Card = { id: string; text: string; url: string | null; done: boolean; x: number; y: number; sort_order: number; author_id: string; created_at: string; updated_at: string }`
  - `type CardsState = Record<string, Card>`
  - `nextOrder(cards: Card[]): number`
  - `reorderedOrder(sorted: Card[], from: number, to: number): number` — `from` 위치 카드를 `to`로 옮겼을 때(dnd-kit `arrayMove` 의미) 그 카드의 새 값
  - `byOrder(a: Card, b: Card): number` — 정렬 비교자

- [ ] **Step 1: 템플릿 생성 (기존 `docs/`를 지우지 않도록 임시 폴더에서 복사)**

```bash
cd /Users/park/claudeProject/wedding-sketch
npm create vite@latest scaffold-tmp -- --template react-ts --no-interactive
cp -R scaffold-tmp/. . && rm -rf scaffold-tmp
npm install
npm install @supabase/supabase-js @dnd-kit/core @dnd-kit/sortable
npm install -D vitest
npm pkg set scripts.test="vitest run"
```

`--no-interactive`를 모르는 버전이라는 오류가 나면 그 플래그만 빼고 다시 실행한다. 프롬프트가 뜨면 실험 기능(rolldown 등)은 No, "install and start now"도 No.

- [ ] **Step 2: 타입 작성** — `src/cards/types.ts`

```ts
export type Card = {
  id: string;
  text: string;
  url: string | null;
  done: boolean;
  x: number;
  y: number;
  sort_order: number;
  author_id: string;
  created_at: string;
  updated_at: string;
};

export type CardsState = Record<string, Card>;
```

- [ ] **Step 3: 실패하는 테스트 작성** — `src/lib/order.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { nextOrder, reorderedOrder, byOrder } from './order';
import type { Card } from '../cards/types';

const card = (id: string, sort_order: number, created_at = '2026-01-01T00:00:00Z'): Card => ({
  id, text: '', url: null, done: false, x: 0, y: 0, sort_order,
  author_id: 'u', created_at, updated_at: created_at,
});
const list = [card('a', 0), card('b', 1), card('c', 2)];

describe('nextOrder', () => {
  it('빈 보드면 0', () => expect(nextOrder([])).toBe(0));
  it('최댓값 + 1', () => expect(nextOrder(list)).toBe(3));
});

describe('reorderedOrder', () => {
  it('중간으로: c를 a와 b 사이로', () => expect(reorderedOrder(list, 2, 1)).toBe(0.5));
  it('아래로 한 칸: a를 b와 c 사이로', () => expect(reorderedOrder(list, 0, 1)).toBe(1.5));
  it('맨 앞으로: 첫 카드 - 1', () => expect(reorderedOrder(list, 2, 0)).toBe(-1));
  it('맨 뒤로: 마지막 카드 + 1', () => expect(reorderedOrder(list, 0, 2)).toBe(3));
  it('카드가 하나뿐이면 0', () => expect(reorderedOrder([card('a', 5)], 0, 0)).toBe(0));
});

describe('byOrder', () => {
  it('sort_order 오름차순', () => {
    expect([list[2], list[0], list[1]].sort(byOrder).map(c => c.id)).toEqual(['a', 'b', 'c']);
  });
  it('sort_order가 같으면 created_at 순 (동시 생성)', () => {
    const later = card('x', 1, '2026-01-02T00:00:00Z');
    const earlier = card('y', 1, '2026-01-01T00:00:00Z');
    expect([later, earlier].sort(byOrder).map(c => c.id)).toEqual(['y', 'x']);
  });
  it('sort_order, created_at이 모두 같으면 id 순', () => {
    expect([card('b', 1), card('a', 1)].sort(byOrder).map(c => c.id)).toEqual(['a', 'b']);
  });
});
```

- [ ] **Step 4: 실패 확인**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./order"`

- [ ] **Step 5: 구현** — `src/lib/order.ts`

```ts
import type { Card } from '../cards/types';

export function nextOrder(cards: Card[]): number {
  return cards.length ? Math.max(...cards.map(c => c.sort_order)) + 1 : 0;
}

// sorted[from] 카드를 to 위치로 옮겼을 때 그 카드의 새 sort_order. 다른 카드는 그대로 둔다.
export function reorderedOrder(sorted: Card[], from: number, to: number): number {
  const rest = sorted.filter((_, i) => i !== from);
  const before = rest[to - 1]?.sort_order;
  const after = rest[to]?.sort_order;
  if (before === undefined && after === undefined) return 0;
  if (before === undefined) return after! - 1;
  if (after === undefined) return before + 1;
  // ponytail: 같은 값 두 개 사이에 놓으면 평균도 같아 위치가 안 바뀜. 동시 생성 때만 생김, 문제 되면 전체 재번호 추가
  return (before + after) / 2;
}

export function byOrder(a: Card, b: Card): number {
  return a.sort_order - b.sort_order
    || a.created_at.localeCompare(b.created_at)
    || a.id.localeCompare(b.id);
}
```

- [ ] **Step 6: 통과 확인**

Run: `npm test`
Expected: PASS (10 tests)

- [ ] **Step 7: 커밋**

```bash
git add -A
git commit -m "feat: scaffold Vite app and sort_order logic"
```

---

### Task 2: Supabase 스키마, RLS, 대시보드 설정

**Files:**
- Create: `supabase/migrations/0001_init.sql`, `supabase/checks/rls_check.sql`

**Interfaces:**
- Produces: 테이블 `public.cards` (컬럼은 `Card` 타입과 1:1), `public.allowed_emails(email)`. Realtime publication에 `cards` 포함.

- [ ] **Step 1: 스키마 작성** — `supabase/migrations/0001_init.sql`

```sql
create table public.allowed_emails (
  email text primary key
);

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  text text not null default '',
  url text,
  done boolean not null default false,
  x real not null,
  y real not null,
  sort_order double precision not null,
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.allowed_emails enable row level security;
alter table public.cards enable row level security;

-- 자기 이메일 행만 보인다 (로그인 직후 접근 권한 확인용)
create policy "own email" on public.allowed_emails
  for select to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));

-- 허용 목록에 있는 사용자만 카드 전체 읽기/쓰기
create policy "allowed users" on public.cards
  for all to authenticated
  using (exists (select 1 from public.allowed_emails where lower(email) = lower(auth.jwt() ->> 'email')))
  with check (exists (select 1 from public.allowed_emails where lower(email) = lower(auth.jwt() ->> 'email')));

create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger cards_touch_updated_at
  before update on public.cards
  for each row execute function public.touch_updated_at();

alter publication supabase_realtime add table public.cards;
```

- [ ] **Step 2: RLS 체크 작성** — `supabase/checks/rls_check.sql`

```sql
-- 최소 1명이 로그인해 auth.users에 행이 있어야 실행 가능. 트랜잭션은 롤백되어 흔적이 남지 않는다.
begin;

insert into public.cards (x, y, sort_order, author_id)
select 0, 0, 0, id from auth.users limit 1;

set local role authenticated;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated","email":"stranger@example.com"}', true);
select count(*) as stranger_sees from public.cards;   -- 기대값: 0

select set_config('request.jwt.claims',
  json_build_object('sub', gen_random_uuid(), 'role', 'authenticated',
    'email', (select email from public.allowed_emails limit 1))::text, true);
select count(*) as allowed_sees from public.cards;    -- 기대값: 1 이상

rollback;
```

- [ ] **Step 3: 커밋**

```bash
git add supabase
git commit -m "feat: add Supabase schema with RLS"
```

- [ ] **Step 4: (사용자 수행) Supabase 프로젝트와 Google 로그인 설정**

1. supabase.com에서 새 프로젝트를 만든다.
2. SQL Editor에서 `0001_init.sql` 전체를 실행한다.
3. 같은 곳에서 두 사람의 이메일을 넣는다: `insert into public.allowed_emails values ('me@gmail.com'), ('her@gmail.com');`
4. Google Cloud Console → APIs & Services → Credentials → OAuth client ID(Web)를 만든다. Authorized redirect URI는 `https://<project-ref>.supabase.co/auth/v1/callback`.
5. Supabase → Authentication → Providers → Google을 켜고 Client ID/Secret을 넣는다.
6. Supabase → Authentication → URL Configuration: Site URL `http://localhost:5173`, Redirect URLs에 `http://localhost:5173`를 추가한다 (배포 URL은 Task 8에서 추가).
7. Project Settings → API에서 Project URL과 anon(publishable) key를 확인해 둔다 (Task 3에서 사용).

---

### Task 3: Supabase 클라이언트 + 로그인 게이트 + 스타일

**Files:**
- Create: `.env.example`, `.env.local` (커밋 안 됨), `src/lib/supabase.ts`, `src/auth/AuthGate.tsx`
- Modify: `src/App.tsx` (전체 교체), `src/index.css` (전체 교체)
- Delete: `src/App.css`, `src/assets/react.svg`

**Interfaces:**
- Consumes: Task 2의 `allowed_emails` 테이블
- Produces:
  - `supabase: SupabaseClient` (`src/lib/supabase.ts`)
  - `<AuthGate>{(user: User) => ReactNode}</AuthGate>` — 허용된 사용자일 때만 children 호출
  - CSS 클래스(이후 모든 Task에서 사용): `.center .topbar .tabs .banner .toast .canvas .canvas-layer .canvas-card .empty .card .done .muted .list .row .row-body .dragging .handle .sheet-backdrop .sheet .sheet-actions`, 버튼 `.primary .danger`, `button[aria-pressed]`

- [ ] **Step 1: 환경 변수**

`.env.example`:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-or-publishable-key>
```

같은 내용에 실제 값을 넣어 `.env.local`을 만든다 (템플릿 `.gitignore`의 `*.local`로 커밋 제외됨. `git status`로 확인).

- [ ] **Step 2: 클라이언트** — `src/lib/supabase.ts`

```ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);
```

- [ ] **Step 3: 로그인 게이트** — `src/auth/AuthGate.tsx`

```tsx
import { useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export function AuthGate({ children }: { children: (user: User) => ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [allowed, setAllowed] = useState<boolean | undefined>(undefined);
  const userId = session?.user.id;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    setAllowed(undefined);
    if (!userId) return;
    supabase.from('allowed_emails').select('email')
      .then(({ data, error }) => setAllowed(!error && data.length > 0));
  }, [userId]);

  if (session === undefined) return null;

  if (!session) {
    return (
      <main className="center">
        <h1>Wedding Sketch</h1>
        <button className="primary" onClick={() =>
          supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin } })}>
          Google로 로그인
        </button>
      </main>
    );
  }

  if (allowed === undefined) return null;

  if (!allowed) {
    return (
      <main className="center">
        <p>접근 권한이 없는 계정입니다<br /><span className="muted">{session.user.email}</span></p>
        <button onClick={() => supabase.auth.signOut()}>로그아웃</button>
      </main>
    );
  }

  return <>{children(session.user)}</>;
}
```

- [ ] **Step 4: 임시 App** — `src/App.tsx` 전체 교체 (Task 5에서 Board로 바뀜)

```tsx
import { AuthGate } from './auth/AuthGate';

export default function App() {
  return <AuthGate>{user => <main className="center">{user.email} 로그인됨</main>}</AuthGate>;
}
```

```bash
rm src/App.css src/assets/react.svg
```

- [ ] **Step 5: 전체 스타일** — `src/index.css` 전체 교체

```css
:root {
  --bg: #faf7f2; --fg: #2b2622; --muted: #8c847c; --card: #fffdf8; --line: #e6dfd5;
  --accent: #c76b7e; --danger: #c0392b;
  color-scheme: light dark;
  font-family: system-ui, -apple-system, "Apple SD Gothic Neo", sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root { --bg: #1d1a18; --fg: #eee7df; --muted: #9a918a; --card: #2a2623; --line: #3a3430; }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); }
button { font: inherit; color: inherit; background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 6px 12px; min-height: 36px; }
button[aria-pressed="true"] { background: var(--fg); color: var(--bg); }
button.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
button.danger { color: var(--danger); }
.center { min-height: 100dvh; display: grid; place-content: center; gap: 12px; text-align: center; padding: 16px; }
.muted { color: var(--muted); }

.topbar { position: fixed; top: 0; left: 0; right: 0; z-index: 10; display: flex; gap: 8px; align-items: center; padding: 8px 12px; padding-top: max(8px, env(safe-area-inset-top)); background: color-mix(in srgb, var(--bg) 85%, transparent); backdrop-filter: blur(8px); border-bottom: 1px solid var(--line); }
.topbar .tabs { display: flex; gap: 4px; margin-right: auto; }
.banner { position: fixed; top: 64px; left: 50%; transform: translateX(-50%); z-index: 10; background: var(--muted); color: #fff; padding: 4px 12px; border-radius: 999px; font-size: 13px; }
.toast { position: fixed; bottom: 24px; left: 16px; right: 16px; z-index: 30; background: var(--danger); color: #fff; padding: 12px 16px; border-radius: 10px; text-align: center; }

.canvas { position: fixed; inset: 0; overflow: hidden; touch-action: none; background-image: radial-gradient(var(--line) 1px, transparent 1px); background-size: 24px 24px; }
.canvas-layer { position: absolute; left: 0; top: 0; transform-origin: 0 0; }
.canvas-card { position: absolute; width: 160px; user-select: none; -webkit-user-select: none; }
.empty { position: fixed; top: 45%; width: 100%; text-align: center; color: var(--muted); pointer-events: none; }

.card { position: relative; background: var(--card); border: 1px solid var(--line); border-left: 6px solid; border-radius: 8px; padding: 10px 28px 10px 12px; box-shadow: 0 1px 3px rgb(0 0 0 / .08); }
.card p { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 6; -webkit-box-orient: vertical; overflow: hidden; }
.card.done { opacity: .5; }
.card.done p { text-decoration: line-through; }
.card a { position: absolute; top: 6px; right: 6px; text-decoration: none; }

.list { list-style: none; margin: 0 auto; padding: 72px 16px 32px; max-width: 720px; display: grid; gap: 8px; }
.row { display: flex; align-items: stretch; gap: 8px; }
.row-body { flex: 1; min-width: 0; }
.row.dragging { position: relative; z-index: 1; opacity: .85; }
.handle { touch-action: none; min-width: 44px; font-size: 20px; cursor: grab; }

.sheet-backdrop { position: fixed; inset: 0; z-index: 20; background: rgb(0 0 0 / .35); display: flex; align-items: flex-end; justify-content: center; }
.sheet { width: 100%; max-width: 560px; background: var(--bg); border-radius: 16px 16px 0 0; padding: 16px; padding-bottom: max(16px, env(safe-area-inset-bottom)); display: grid; gap: 12px; }
.sheet textarea { min-height: 120px; resize: vertical; }
.sheet textarea, .sheet input[type="url"] { font: inherit; font-size: 16px; color: inherit; background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 10px; width: 100%; }
.sheet-actions { display: flex; justify-content: space-between; }
```

- [ ] **Step 6: 빌드 확인**

Run: `npm run build && npm test`
Expected: 타입 에러 없이 빌드 성공, 테스트 PASS

- [ ] **Step 7: 수동 확인**

Run: `npm run dev` → `http://localhost:5173`
- 허용된 계정으로 로그인 → "<이메일> 로그인됨"
- 허용 목록에 없는 계정으로 로그인 → "접근 권한이 없는 계정입니다" + 로그아웃 버튼 동작
- 둘 다 로그인한 뒤 Supabase SQL Editor에서 `supabase/checks/rls_check.sql` 실행 → `stranger_sees = 0`, `allowed_sees >= 1`

- [ ] **Step 8: 커밋**

```bash
git add -A
git commit -m "feat: Google login gate with allowed-email check"
```

---

### Task 4: 카드 데이터 계층 (원격 반영 + 훅)

**Files:**
- Create: `src/cards/applyRemote.ts`, `src/cards/useCards.ts`
- Test: `src/cards/applyRemote.test.ts`

**Interfaces:**
- Consumes: `Card`, `CardsState` (Task 1), `supabase` (Task 3)
- Produces:
  - `type RemoteChange = { eventType: 'INSERT' | 'UPDATE'; new: Card } | { eventType: 'DELETE'; old: { id: string } }`
  - `applyRemote(state: CardsState, change: RemoteChange, lockedId: string | null): CardsState`
  - `useCards(userId: string): { cards: CardsState; online: boolean; error: string | null; clearError(): void; create(x: number, y: number, sortOrder: number): string; update(id: string, patch: Partial<Card>): void; remove(id: string): void; setDragging(id: string | null): void }` — `create`는 새 카드 id를 반환. `update`/`remove`/`setDragging`은 참조가 안정적(useCallback).

- [ ] **Step 1: 실패하는 테스트 작성** — `src/cards/applyRemote.test.ts`

```ts
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
```

- [ ] **Step 2: 실패 확인**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./applyRemote"`

- [ ] **Step 3: 구현** — `src/cards/applyRemote.ts`

```ts
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
```

- [ ] **Step 4: 통과 확인**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: 훅 구현** — `src/cards/useCards.ts`

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { applyRemote, type RemoteChange } from './applyRemote';
import type { Card, CardsState } from './types';

export function useCards(userId: string) {
  const [cards, setCards] = useState<CardsState>({});
  const [online, setOnline] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lockRef = useRef<string | null>(null);

  const reload = useCallback(async () => {
    const { data, error } = await supabase.from('cards').select('*');
    if (error) return setError('불러오기 실패');
    setCards(Object.fromEntries((data as Card[]).map(c => [c.id, c])));
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
    run(supabase.from('cards').insert(card));
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
```

- [ ] **Step 6: 빌드 확인** (훅은 Task 5에서 처음 쓰임)

Run: `npm run build && npm test`
Expected: 빌드 성공, 테스트 PASS

- [ ] **Step 7: 커밋**

```bash
git add src/cards
git commit -m "feat: cards data layer with realtime sync and optimistic writes"
```

---

### Task 5: 캔버스 보기 + 앱 셸

**Files:**
- Create: `src/lib/url.ts`, `src/cards/authorColor.ts`, `src/cards/CardView.tsx`, `src/views/geometry.ts`, `src/views/CanvasView.tsx`
- Modify: `src/App.tsx` (전체 교체)
- Test: `src/lib/url.test.ts`, `src/views/geometry.test.ts`

**Interfaces:**
- Consumes: `useCards` (Task 4), `nextOrder`, `byOrder` (Task 1), `AuthGate` (Task 3)
- Produces:
  - `normalizeUrl(input: string | null): string | null` — http(s)만 통과, 스킴 없으면 `https://` 붙임
  - `authorColors(cards: Card[]): (authorId: string) => string`
  - `<CardView card={Card} color={string} />`
  - `type View = { x: number; y: number; scale: number }`, `CARD_W = 160`, `screenToCanvas(v: View, sx: number, sy: number): { x: number; y: number }`, `zoomAt(v: View, sx: number, sy: number, factor: number): View`, `isDrag(dx: number, dy: number): boolean`
  - `<CanvasView cards view setView colorOf onMove onTap setDragging />`
  - `App.tsx`의 `Board` 컴포넌트 — 이후 Task 6, 7이 이 파일을 수정

- [ ] **Step 1: 실패하는 테스트 작성** — `src/lib/url.test.ts`

```ts
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
```

`src/views/geometry.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { screenToCanvas, zoomAt, isDrag, MAX_SCALE, MIN_SCALE } from './geometry';

const v = { x: 100, y: 50, scale: 2 };

describe('screenToCanvas', () => {
  it('pan과 scale을 되돌림', () => expect(screenToCanvas(v, 300, 250)).toEqual({ x: 100, y: 100 }));
});

describe('zoomAt', () => {
  it('기준 화면 지점의 캔버스 좌표가 유지됨', () => {
    const v1 = { x: 100, y: 50, scale: 1 };
    const z = zoomAt(v1, 200, 300, 1.25);
    expect(z.scale).toBe(1.25);
    const before = screenToCanvas(v1, 200, 300);
    const after = screenToCanvas(z, 200, 300);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });
  it('최대/최소 배율로 제한', () => {
    expect(zoomAt(v, 0, 0, 10).scale).toBe(MAX_SCALE);
    expect(zoomAt(v, 0, 0, 0.01).scale).toBe(MIN_SCALE);
  });
});

describe('isDrag', () => {
  it('6px 이하 이동은 탭', () => expect(isDrag(3, 3)).toBe(false));
  it('6px 초과 이동은 드래그', () => expect(isDrag(10, 0)).toBe(true));
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test`
Expected: FAIL — `./url`, `./geometry` 를 찾을 수 없음

- [ ] **Step 3: 순수 함수 구현**

`src/lib/url.ts`:

```ts
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
```

`src/views/geometry.ts`:

```ts
export type View = { x: number; y: number; scale: number };

export const CARD_W = 160;
export const MIN_SCALE = 0.25;
export const MAX_SCALE = 2;

export function screenToCanvas(v: View, sx: number, sy: number) {
  return { x: (sx - v.x) / v.scale, y: (sy - v.y) / v.scale };
}

// 화면의 (sx, sy) 지점을 고정한 채 확대/축소
export function zoomAt(v: View, sx: number, sy: number, factor: number): View {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor));
  const p = screenToCanvas(v, sx, sy);
  return { x: sx - p.x * scale, y: sy - p.y * scale, scale };
}

export const isDrag = (dx: number, dy: number) => Math.hypot(dx, dy) > 6;
```

- [ ] **Step 4: 통과 확인**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: 작성자 색 + 카드 표시**

`src/cards/authorColor.ts`:

```ts
import type { Card } from './types';

const COLORS = ['#e07a8f', '#5b8fd6'];

// ponytail: author_id 정렬 순서로 색 배정. 두 사람이 모두 카드를 쓰기 전엔 색이 한 번 바뀔 수 있음, 거슬리면 사용자별 색을 테이블에 저장
export function authorColors(cards: Card[]) {
  const ids = [...new Set(cards.map(c => c.author_id))].sort();
  return (authorId: string) => COLORS[ids.indexOf(authorId) % COLORS.length] ?? COLORS[0];
}
```

`src/cards/CardView.tsx`:

```tsx
import type { Card } from './types';
import { normalizeUrl } from '../lib/url';

export function CardView({ card, color }: { card: Card; color: string }) {
  const href = normalizeUrl(card.url);
  return (
    <div className={card.done ? 'card done' : 'card'} style={{ borderLeftColor: color }}>
      <p>{card.text || <span className="muted">빈 메모</span>}</p>
      {href && (
        <a href={href} target="_blank" rel="noreferrer" aria-label="링크 열기" onClick={e => e.stopPropagation()}>
          🔗
        </a>
      )}
    </div>
  );
}
```

- [ ] **Step 6: 캔버스** — `src/views/CanvasView.tsx`

```tsx
import { useRef, useState } from 'react';
import type { Card } from '../cards/types';
import { CardView } from '../cards/CardView';
import { isDrag, type View } from './geometry';

type Gesture =
  | { kind: 'pan'; sx: number; sy: number; ox: number; oy: number }
  | { kind: 'card'; id: string; sx: number; sy: number; ox: number; oy: number; x: number; y: number; moved: boolean };

type Props = {
  cards: Card[];
  view: View;
  setView: (v: View) => void;
  colorOf: (authorId: string) => string;
  onMove: (id: string, x: number, y: number) => void;
  onTap: (id: string) => void;
  setDragging: (id: string | null) => void;
};

export function CanvasView({ cards, view, setView, colorOf, onMove, onTap, setDragging }: Props) {
  const g = useRef<Gesture | null>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('a')) return; // 링크 탭은 그대로 통과
    const id = target.closest<HTMLElement>('[data-card-id]')?.dataset.cardId;
    const card = id ? cards.find(c => c.id === id) : undefined;
    e.currentTarget.setPointerCapture(e.pointerId);
    g.current = card
      ? { kind: 'card', id: card.id, sx: e.clientX, sy: e.clientY, ox: card.x, oy: card.y, x: card.x, y: card.y, moved: false }
      : { kind: 'pan', sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const cur = g.current;
    if (!cur) return;
    const dx = e.clientX - cur.sx;
    const dy = e.clientY - cur.sy;
    if (cur.kind === 'pan') return setView({ ...view, x: cur.ox + dx, y: cur.oy + dy });
    if (!cur.moved) {
      if (!isDrag(dx, dy)) return;
      cur.moved = true;
      setDragging(cur.id);
    }
    cur.x = cur.ox + dx / view.scale;
    cur.y = cur.oy + dy / view.scale;
    setDrag({ id: cur.id, x: cur.x, y: cur.y });
  };

  const onPointerUp = () => {
    const cur = g.current;
    g.current = null;
    if (cur?.kind !== 'card') return;
    if (!cur.moved) return onTap(cur.id);
    onMove(cur.id, cur.x, cur.y);
    setDrag(null);
    setDragging(null);
  };

  const onPointerCancel = () => {
    g.current = null;
    setDrag(null);
    setDragging(null);
  };

  return (
    <div className="canvas" onPointerDown={onPointerDown} onPointerMove={onPointerMove}
      onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}>
      <div className="canvas-layer" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}>
        {cards.map(c => {
          const pos = drag?.id === c.id ? drag : c;
          return (
            <div key={c.id} data-card-id={c.id} className="canvas-card" style={{ left: pos.x, top: pos.y }}>
              <CardView card={c} color={colorOf(c.author_id)} />
            </div>
          );
        })}
      </div>
      {cards.length === 0 && <p className="empty">"새 메모"를 눌러 첫 아이디어를 적어 보세요</p>}
    </div>
  );
}
```

- [ ] **Step 7: 앱 셸** — `src/App.tsx` 전체 교체

```tsx
import { useMemo, useState } from 'react';
import { AuthGate } from './auth/AuthGate';
import { useCards } from './cards/useCards';
import { authorColors } from './cards/authorColor';
import { byOrder, nextOrder } from './lib/order';
import { CanvasView } from './views/CanvasView';
import { CARD_W, screenToCanvas, zoomAt, type View } from './views/geometry';

export default function App() {
  return <AuthGate>{user => <Board userId={user.id} />}</AuthGate>;
}

function Board({ userId }: { userId: string }) {
  const { cards, online, error, clearError, create, update, setDragging } = useCards(userId);
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: 1 });
  const list = useMemo(() => Object.values(cards).sort(byOrder), [cards]);
  const colorOf = useMemo(() => authorColors(list), [list]);

  // 캔버스가 화면 전체를 덮으므로 화면 중앙 = 보이는 영역 중앙
  const zoom = (factor: number) => setView(v => zoomAt(v, innerWidth / 2, innerHeight / 2, factor));
  const add = () => {
    const c = screenToCanvas(view, innerWidth / 2, innerHeight / 2);
    create(c.x - CARD_W / 2, c.y - 40, nextOrder(list));
  };

  return (
    <>
      <CanvasView cards={list} view={view} setView={setView} colorOf={colorOf}
        onMove={(id, x, y) => update(id, { x, y })} onTap={() => {}} setDragging={setDragging} />
      <header className="topbar">
        <div className="tabs" />
        <button aria-label="축소" onClick={() => zoom(1 / 1.25)}>−</button>
        <button aria-label="확대" onClick={() => zoom(1.25)}>+</button>
        <button className="primary" onClick={add}>새 메모</button>
      </header>
      {!online && <div className="banner">오프라인 · 연결되면 다시 불러옵니다</div>}
      {error && <div className="toast" role="alert" onClick={clearError}>{error}</div>}
    </>
  );
}
```

- [ ] **Step 8: 빌드 + 테스트**

Run: `npm run build && npm test`
Expected: 빌드 성공, 테스트 PASS

- [ ] **Step 9: 수동 확인** (`npm run dev`, 브라우저 두 개를 각각 다른 허용 계정으로 로그인)

- "새 메모" → 화면 중앙에 "빈 메모" 카드가 생기고, 다른 창에도 몇 초 안에 나타남
- 카드 드래그 → 놓은 자리에 고정, 다른 창에도 반영. 새로고침해도 유지
- 빈 곳 드래그 → 캔버스 이동. −/+ → 화면 중앙 기준으로 확대/축소
- 두 사람의 카드 왼쪽 테두리 색이 서로 다름
- 개발자도구 Network를 Offline으로 → "오프라인" 배지. 다시 Online → 배지 사라지고 목록 재로드
- 개발자도구 device toolbar(터치 에뮬레이션)에서 카드 드래그 동작

- [ ] **Step 10: 커밋**

```bash
git add -A
git commit -m "feat: canvas view with drag, pan, zoom and realtime cards"
```

---

### Task 6: 카드 편집 시트

**Files:**
- Create: `src/lib/saver.ts`, `src/cards/EditSheet.tsx`
- Modify: `src/App.tsx`
- Test: `src/lib/saver.test.ts`

**Interfaces:**
- Consumes: `useCards().update/remove` (Task 4), `normalizeUrl` (Task 5), `Board` (Task 5)
- Produces:
  - `createSaver<T extends object>(save: (patch: T) => void, ms?: number): { queue(patch: T): void; flush(): void; cancel(): void }`
  - `<EditSheet card update remove onClose />`

- [ ] **Step 1: 실패하는 테스트 작성** — `src/lib/saver.test.ts`

```ts
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
```

- [ ] **Step 2: 실패 확인**

Run: `npm test`
Expected: FAIL — `./saver` 를 찾을 수 없음

- [ ] **Step 3: 구현** — `src/lib/saver.ts`

```ts
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
```

- [ ] **Step 4: 통과 확인**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: 시트** — `src/cards/EditSheet.tsx`

```tsx
import { useEffect, useState } from 'react';
import type { Card } from './types';
import { createSaver } from '../lib/saver';
import { normalizeUrl } from '../lib/url';

type Props = {
  card: Card;
  update: (id: string, patch: Partial<Card>) => void;
  remove: (id: string) => void;
  onClose: () => void;
};

// key={card.id}로 렌더링할 것 — 카드가 바뀌면 새로 마운트
export function EditSheet({ card, update, remove, onClose }: Props) {
  const [text, setText] = useState(card.text);
  const [url, setUrl] = useState(card.url ?? '');
  const [saver] = useState(() => createSaver<Partial<Card>>(patch => update(card.id, patch)));

  useEffect(() => saver.flush, [saver]); // 닫힐 때 남은 입력 저장

  const onDelete = () => {
    if (!confirm('이 메모를 삭제할까요?')) return;
    saver.cancel();
    remove(card.id);
    onClose();
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label="메모 편집" onClick={e => e.stopPropagation()}>
        <textarea autoFocus value={text} placeholder="메모"
          onChange={e => { setText(e.target.value); saver.queue({ text: e.target.value }); }} />
        <input type="url" inputMode="url" value={url} placeholder="링크 (선택)"
          onChange={e => { setUrl(e.target.value); saver.queue({ url: normalizeUrl(e.target.value) }); }} />
        <label>
          <input type="checkbox" checked={card.done} onChange={e => update(card.id, { done: e.target.checked })} /> 완료
        </label>
        <div className="sheet-actions">
          <button className="danger" onClick={onDelete}>삭제</button>
          <button onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: App에 연결** — `src/App.tsx`

import 추가 (기존 `import { useCards } ...` 아래):

```tsx
import { EditSheet } from './cards/EditSheet';
```

`Board` 첫 줄을 교체:

```tsx
  const { cards, online, error, clearError, create, update, remove, setDragging } = useCards(userId);
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: 1 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = editingId ? cards[editingId] : undefined; // 상대가 삭제하면 undefined → 시트 닫힘
```

(기존 `const [view, setView] = ...` 줄은 위 블록에 포함되므로 지운다.)

`add`의 `create(...)` 줄을 교체 — 새 카드를 만들자마자 편집 시트를 연다:

```tsx
    setEditingId(create(c.x - CARD_W / 2, c.y - 40, nextOrder(list)));
```

`<CanvasView ... onTap={() => {}} ...>`의 `onTap={() => {}}`를 `onTap={setEditingId}`로 바꾼다.

토스트 줄 아래에 추가:

```tsx
      {editing && (
        <EditSheet key={editing.id} card={editing} update={update} remove={remove} onClose={() => setEditingId(null)} />
      )}
```

- [ ] **Step 7: 빌드 + 테스트**

Run: `npm run build && npm test`
Expected: 빌드 성공, 테스트 PASS

- [ ] **Step 8: 수동 확인** (브라우저 두 개)

- "새 메모" → 시트가 바로 열리고 텍스트 입력 → 다른 창에 약 0.5초 뒤 반영
- 입력 직후 곧바로 "닫기" → 마지막 글자까지 저장됨 (새로고침으로 확인)
- 링크 `instagram.com` 입력 → 카드에 🔗, 탭하면 `https://instagram.com/` 새 탭. `javascript:alert(1)` 입력 → 🔗 없음
- 완료 체크 → 카드가 흐려지고 취소선, 다른 창에도 반영
- 삭제 → 확인 후 사라짐. A창에서 시트를 연 상태로 B창에서 그 카드를 삭제 → A창의 시트가 닫힘
- 캔버스에서 카드를 짧게 탭 → 시트 열림. 드래그 → 시트 안 열림

- [ ] **Step 9: 커밋**

```bash
git add -A
git commit -m "feat: card edit sheet with debounced autosave"
```

---

### Task 7: 정리 모드 (리스트 + 터치 드래그 재정렬)

**Files:**
- Create: `src/views/ListView.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `reorderedOrder` (Task 1), `CardView` (Task 5), `Board` (Task 6)
- Produces: `<ListView cards colorOf onReorder onTap setDragging />` — `cards`는 `byOrder`로 정렬된 배열이어야 함

- [ ] **Step 1: 리스트** — `src/views/ListView.tsx`

```tsx
import {
  DndContext, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Card } from '../cards/types';
import { CardView } from '../cards/CardView';
import { reorderedOrder } from '../lib/order';

type Props = {
  cards: Card[];
  colorOf: (authorId: string) => string;
  onReorder: (id: string, sortOrder: number) => void;
  onTap: (id: string) => void;
  setDragging: (id: string | null) => void;
};

export function ListView({ cards, colorOf, onReorder, onTap, setDragging }: Props) {
  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) {
      const from = cards.findIndex(c => c.id === active.id);
      const to = cards.findIndex(c => c.id === over.id);
      onReorder(String(active.id), reorderedOrder(cards, from, to));
    }
    setDragging(null);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter}
      onDragStart={e => setDragging(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
      <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
        <ol className="list">
          {cards.map(c => <Row key={c.id} card={c} color={colorOf(c.author_id)} onTap={onTap} />)}
          {cards.length === 0 && <li className="muted">아직 메모가 없어요</li>}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

function Row({ card, color, onTap }: { card: Card; color: string; onTap: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
  return (
    <li ref={setNodeRef} className={isDragging ? 'row dragging' : 'row'}
      style={{ transform: transform ? `translate3d(0, ${transform.y}px, 0)` : undefined, transition }}>
      <div className="row-body" onClick={() => onTap(card.id)}>
        <CardView card={card} color={color} />
      </div>
      <button className="handle" aria-label="순서 바꾸기" {...attributes} {...listeners}>≡</button>
    </li>
  );
}
```

- [ ] **Step 2: App에 탭 연결** — `src/App.tsx`

import 추가:

```tsx
import { ListView } from './views/ListView';
```

`Board`의 `editingId` 줄 아래에 추가:

```tsx
  const [mode, setMode] = useState<'canvas' | 'list'>('canvas');
```

`<CanvasView ... />` 요소 전체를 교체:

```tsx
      {mode === 'canvas' ? (
        <CanvasView cards={list} view={view} setView={setView} colorOf={colorOf}
          onMove={(id, x, y) => update(id, { x, y })} onTap={setEditingId} setDragging={setDragging} />
      ) : (
        <ListView cards={list} colorOf={colorOf}
          onReorder={(id, sort_order) => update(id, { sort_order })} onTap={setEditingId} setDragging={setDragging} />
      )}
```

`<header>` 안에서 `<div className="tabs" />`부터 확대 버튼까지를 교체 (줌 버튼은 캔버스에서만):

```tsx
        <div className="tabs">
          <button aria-pressed={mode === 'canvas'} onClick={() => setMode('canvas')}>캔버스</button>
          <button aria-pressed={mode === 'list'} onClick={() => setMode('list')}>정리</button>
        </div>
        {mode === 'canvas' && (
          <>
            <button aria-label="축소" onClick={() => zoom(1 / 1.25)}>−</button>
            <button aria-label="확대" onClick={() => zoom(1.25)}>+</button>
          </>
        )}
```

- [ ] **Step 3: 빌드 + 테스트**

Run: `npm run build && npm test`
Expected: 빌드 성공, 테스트 PASS

- [ ] **Step 4: 수동 확인** (브라우저 두 개 + device toolbar 터치 에뮬레이션)

- "정리" 탭 → 모든 카드가 세로 리스트, 생성 순서대로
- ≡ 손잡이를 잡고 위아래로 드래그 → 놓은 자리에 고정, 다른 창의 정리 모드에도 반영, 새로고침해도 유지
- 맨 앞, 맨 뒤로 이동해도 동작
- 손잡이가 아닌 곳을 터치해 스크롤하면 드래그가 시작되지 않고 페이지가 스크롤됨
- 카드 본문 탭 → 편집 시트
- 정리에서 순서를 바꾼 뒤 "캔버스"로 돌아가면 카드 위치는 그대로

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "feat: organize mode with touch drag reordering"
```

---

### Task 8: PWA 메타데이터 + 배포 + 최종 검증

**Files:**
- Create: `public/manifest.webmanifest`, `public/icon.svg`
- Modify: `index.html`
- Delete: `public/vite.svg`

**Interfaces:**
- Consumes: 완성된 앱 (Task 1~7)
- Produces: 배포된 URL

- [ ] **Step 1: 아이콘과 매니페스트**

`public/icon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="#c76b7e"/><path d="M256 400s-136-84-136-180a72 72 0 0 1 136-34 72 72 0 0 1 136 34c0 96-136 180-136 180z" fill="#fffdf8"/></svg>
```

`public/manifest.webmanifest`:

```json
{
  "name": "Wedding Sketch",
  "short_name": "Sketch",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#faf7f2",
  "theme_color": "#c76b7e",
  "icons": [{ "src": "/icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any" }]
}
```

```bash
rm public/vite.svg
```

- [ ] **Step 2: `index.html` 수정**

- `<html lang="en">` → `<html lang="ko">`
- `<link rel="icon" type="image/svg+xml" href="/vite.svg" />` → `<link rel="icon" type="image/svg+xml" href="/icon.svg" />`
- `<title>`의 내용 → `Wedding Sketch`
- `<title>` 아래에 추가:

```html
    <link rel="manifest" href="/manifest.webmanifest" />
    <meta name="theme-color" content="#c76b7e" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="Sketch" />
```

- [ ] **Step 3: 빌드 확인 후 커밋**

Run: `npm run build && npm test`
Expected: 빌드 성공, 테스트 PASS

```bash
git add -A
git commit -m "feat: PWA manifest and icon"
```

- [ ] **Step 4: (사용자 수행) 배포**

1. 코드를 GitHub 저장소에 push한다.
2. vercel.com → Add New Project → 저장소를 import한다 (Vite로 자동 인식).
3. Environment Variables에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`를 넣고 Deploy한다.
4. Supabase → Authentication → URL Configuration: Site URL을 배포 URL로 바꾸고, Redirect URLs에 배포 URL을 추가한다 (localhost는 남겨 둠).

- [ ] **Step 5: (사용자 수행) 실제 기기로 최종 검증** — 폰 1대 + 태블릿 1대, 각각 다른 허용 계정

- [ ] 두 기기 모두 배포 URL에서 구글 로그인 성공
- [ ] 홈 화면에 추가 → 주소창 없이 열림
- [ ] 폰에서 새 메모 작성 → 태블릿에 수 초 안에 나타남
- [ ] 태블릿에서 그 카드를 손가락으로 드래그 → 폰에 위치 반영
- [ ] 정리 모드에서 손잡이를 길게 눌러 드래그해 순서 변경 → 다른 기기에 반영
- [ ] 한 기기를 비행기 모드로 → "오프라인" 배지, 해제 → 배지 사라지고 최신 상태로 갱신
- [ ] 허용되지 않은 구글 계정으로 로그인 → "접근 권한이 없는 계정입니다"
