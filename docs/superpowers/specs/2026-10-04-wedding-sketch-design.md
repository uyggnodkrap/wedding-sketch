# Wedding Sketch — 설계 스펙

- 작성일: 2026-10-04
- 상태: 리뷰 대기

## 1. 목적

커플 두 사람이 결혼 준비 아이디어를 자유롭게 메모하고, 그 메모들을 준비 순서에 따라 재배치하는 개인용 앱.

**성공 기준**
- 두 사람이 각자 폰/태블릿에서 같은 보드를 보고, 한쪽의 변경이 다른 쪽에 수 초 내 반영된다.
- 자유 캔버스에 카드를 붙이고 터치로 옮길 수 있다.
- "정리 모드"에서 같은 카드들을 리스트로 보고 터치 드래그로 순서를 바꿀 수 있다.
- 관리자가 만든 계정 외에는 데이터를 볼 수 없다.

## 2. 범위

**포함**
- 이메일 6자리 코드(OTP) 로그인, 계정은 관리자가 대시보드에서 생성(=승인), 신규 가입 차단
- 카드: 텍스트, 링크(선택), 완료 체크, 작성자 색 구분
- 캔버스 보기: 카드 자유 배치, 캔버스 이동(pan), 버튼 줌
- 정리 모드: `sort_order` 기준 세로 리스트, 터치 드래그 재정렬
- Supabase Realtime 기반 실시간 동기화
- PWA (홈 화면 추가), 폰/태블릿 반응형

**제외 (필요 시 추가)**
- 이미지 업로드 — 링크로 대체
- 핀치 줌 — 버튼 줌으로 시작, 불편하면 추가 (~30줄)
- 여러 보드, 카테고리/태그, 변경 이력
- 오프라인 편집 — 오프라인 표시만
- 동시 편집 충돌 해결 — last-write-wins
- E2E 테스트

## 3. 구조

| 계층 | 선택 |
|---|---|
| 프론트엔드 | React + Vite + TypeScript, PWA |
| 백엔드 | Supabase (Postgres, Realtime, Email OTP, RLS). 서버 코드 없음 |
| 배포 | 정적 호스팅 (Vercel 또는 Netlify 무료 플랜) |
| 추가 의존성 | `@supabase/supabase-js`, `@dnd-kit/core`, `@dnd-kit/sortable` |

## 4. 데이터 모델

### `cards`

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | uuid PK, 기본 `gen_random_uuid()` | |
| `text` | text, not null, 기본 `''` | 메모 본문 |
| `url` | text, null 허용 | 링크 |
| `done` | boolean, not null, 기본 false | 완료 체크 |
| `x` | real, not null | 캔버스 x 좌표 |
| `y` | real, not null | 캔버스 y 좌표 |
| `sort_order` | real, not null | 정리 모드 순서 (오름차순) |
| `author_id` | uuid, not null → `auth.users(id)`, 기본 `auth.uid()` | 작성자 |
| `created_at` | timestamptz, 기본 `now()` | |
| `updated_at` | timestamptz, 기본 `now()` | 업데이트 트리거로 갱신 |

~~`allowed_emails`~~ — 제거됨 (0002 마이그레이션). 승인은 계정 존재로 판단.

### RLS

- `cards`: select / insert / update / delete 모두 `authenticated` 역할이면 허용, `anon`은 전부 차단.
- 승인 = 계정 존재. Auth 설정의 "Allow new users to sign up"은 반드시 꺼 둔다 (켜면 누구나 접근 가능).
- Realtime publication에 `cards` 추가.

### `sort_order` 규칙

- 새 카드: 현재 최댓값 + 1 (빈 보드면 0).
- 재정렬: 놓인 위치 앞뒤 카드 `sort_order`의 평균. 맨 앞이면 첫 카드 − 1, 맨 뒤면 마지막 카드 + 1.
- 다른 카드는 건드리지 않는다. (실수 정밀도 고갈은 두 사람 사용량에선 현실적으로 발생하지 않음)

## 5. 화면과 상호작용

### 로그인
- 이메일 입력 → 메일로 받은 6자리 코드 입력. 매직 링크는 iOS 홈 화면 앱에서 세션이 Safari로 가므로 쓰지 않는다.
- 미등록 이메일에는 코드를 보내지 않는다 (`shouldCreateUser: false`).

### 메인
- 상단 바: `캔버스 | 정리` 전환 탭, `+` (새 카드), 캔버스 보기에선 `−` / `+` 줌 버튼.
- 작성자 색: 두 사용자를 `author_id` 기준으로 고정 색 2개에 매핑.

### 카드 표시
- 포스트잇 형태, 좌측 테두리 = 작성자 색.
- `done`이면 흐리게 + 취소선.
- `url`이 있으면 🔗 아이콘, 탭하면 새 탭에서 열기.

### 캔버스 보기
- 카드 드래그: pointer events 직접 구현 (`touch-action: none`). 놓을 때 `x`, `y` 저장.
- 빈 영역 드래그: 캔버스 전체 pan (CSS `transform: translate(...) scale(...)`).
- 줌: 버튼으로 scale 단계 조절.
- 새 카드: 현재 보이는 화면 중앙 좌표에 생성.
- 탭(드래그 없이 짧게 누름)과 드래그를 이동 거리 임계값으로 구분.

### 정리 모드
- 모든 카드를 `sort_order` 오름차순 세로 리스트로 표시.
- `@dnd-kit/sortable` + TouchSensor/PointerSensor (길게 눌러 시작), 드래그 중 자동 스크롤.
- 놓으면 §4 규칙으로 해당 카드의 `sort_order`만 저장.
- 캔버스 좌표와 독립 — 순서를 바꿔도 `x`, `y`는 그대로.

### 카드 편집
- 카드 탭 → 하단 시트: 텍스트, URL, 완료 체크, 삭제.
- 입력 디바운스 후 자동 저장, 저장 버튼 없음.

## 6. 실시간 동기화

- 시작 시 `cards` 전체 로드 → `postgres_changes` 구독으로 INSERT/UPDATE/DELETE를 로컬 상태에 반영.
- 동시 편집은 last-write-wins.
- 로컬에서 드래그 중인 카드에 대한 원격 업데이트는 드래그가 끝날 때까지 무시.
- Realtime 재연결 시 `cards` 전체 재로드.

## 7. 오류 처리

- 쓰기는 낙관적 업데이트. 실패 시 상단 토스트 "저장 실패, 다시 시도" + 해당 카드를 서버 값으로 롤백.
- 네트워크 끊김 시 상단에 "오프라인" 표시. 오프라인 편집 큐는 없음.
- 미등록 이메일은 코드 발송 단계에서 차단 (가입 불가).

## 8. 테스트

- `sort_order` 계산을 순수 함수로 분리, Vitest 테스트 하나: 중간 삽입, 맨 앞, 맨 뒤, 빈 리스트.
- RLS: `anon`으로 `cards` select 시 0건임을 SQL 체크 하나로 확인.
- 수동 검증: 폰 + 태블릿 두 기기 동시 편집으로 캔버스 드래그, 정리 모드 드래그, 실시간 반영 확인.
