import { useMemo, useState } from 'react';
import { AuthGate } from './auth/AuthGate';
import { useCards } from './cards/useCards';
import { EditSheet } from './cards/EditSheet';
import { ConfirmDialog } from './ConfirmDialog';
import { authorColors } from './cards/authorColor';
import { toggleLink } from './cards/links';
import type { LinkStyle } from './cards/types';
import { byOrder, nextOrder } from './lib/order';
import { CanvasView } from './views/CanvasView';
import { ListView } from './views/ListView';
import { CARD_W, screenToCanvas, zoomAt, type View } from './views/geometry';

export default function App() {
  return <AuthGate>{user => <Board userId={user.id} />}</AuthGate>;
}

function Board({ userId }: { userId: string }) {
  const { cards, links, online, error, clearError, create, update, remove, applyLink, setDragging } = useCards(userId);
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: 1 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mode, setMode] = useState<'canvas' | 'list'>('canvas');
  const editing = editingId ? cards[editingId] : undefined; // 상대가 삭제하면 undefined → 시트 닫힘
  const list = useMemo(() => Object.values(cards).sort(byOrder), [cards]);
  const colorOf = useMemo(() => authorColors(list), [list]);
  const linkList = useMemo(() => Object.values(links), [links]);
  // 연결 모드: 카드 A 탭 → 카드 B 탭으로 A→B 연결 (같은 모양이면 삭제, 다르면 모양 변경)
  const [connecting, setConnecting] = useState(false);
  const [linkStyle, setLinkStyle] = useState<LinkStyle>('line');
  const [fromId, setFromId] = useState<string | null>(null);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);

  const [confirmLinkId, setConfirmLinkId] = useState<string | null>(null);
  const closeLinkConfirm = () => {
    setConfirmLinkId(null);
    setSelectedLinkId(null);
  };

  const onCardTap = (id: string) => {
    setSelectedLinkId(null);
    if (!connecting) return setEditingId(id);
    if (!fromId) return setFromId(id);
    const action = toggleLink(linkList, fromId, id, linkStyle);
    if (action) applyLink(action);
    setFromId(null);
  };
  const toggleConnecting = () => {
    setConnecting(c => !c);
    setFromId(null);
  };

  // 캔버스가 화면 전체를 덮으므로 화면 중앙 = 보이는 영역 중앙
  const zoom = (factor: number) => setView(v => zoomAt(v, innerWidth / 2, innerHeight / 2, factor));
  const add = () => {
    const c = screenToCanvas(view, innerWidth / 2, innerHeight / 2);
    setEditingId(create(c.x - CARD_W / 2, c.y - 40, nextOrder(list)));
  };

  return (
    <>
      {mode === 'canvas' ? (
        <CanvasView cards={list} links={linkList} selectedId={fromId} onBackgroundTap={() => { setFromId(null); setSelectedLinkId(null); }}
          selectedLinkId={selectedLinkId} onLinkTap={setSelectedLinkId} onLinkDoubleTap={setConfirmLinkId}
          view={view} setView={setView} colorOf={colorOf}
          onMove={(id, x, y) => update(id, { x, y })} onTap={onCardTap} setDragging={setDragging} />
      ) : (
        <ListView cards={list} colorOf={colorOf}
          onReorder={(id, sort_order) => update(id, { sort_order })} onTap={setEditingId} setDragging={setDragging} />
      )}
      <header className="topbar">
        <div className="tabs">
          <button aria-pressed={mode === 'canvas'} onClick={() => setMode('canvas')}>캔버스</button>
          <button aria-pressed={mode === 'list'} onClick={() => setMode('list')}>정리</button>
        </div>
        {mode === 'canvas' && (
          <>
            <button aria-pressed={connecting} onClick={toggleConnecting}>연결</button>
            {connecting && (
              <div className="seg">
                <button aria-pressed={linkStyle === 'line'} onClick={() => setLinkStyle('line')}>실선</button>
                <button aria-pressed={linkStyle === 'arrow'} onClick={() => setLinkStyle('arrow')}>화살표</button>
              </div>
            )}
            <button aria-label="축소" onClick={() => zoom(1 / 1.25)}>−</button>
            <button aria-label="확대" onClick={() => zoom(1.25)}>+</button>
          </>
        )}
        <ThemeButton />
        <button className="primary" onClick={add}>새 메모</button>
      </header>
      {mode === 'canvas' && connecting && (
        <div className="hint">{fromId ? '연결할 카드를 탭하세요 (같은 모양으로 다시 연결하면 삭제)' : '시작 카드를 탭하세요'}</div>
      )}
      {!online && <div className="banner">오프라인 · 연결되면 다시 불러옵니다</div>}
      {error && <div className="toast" role="alert" onClick={clearError}>{error}</div>}
      {confirmLinkId && (
        <ConfirmDialog message="이 연결을 삭제할까요?" detail="두 메모는 그대로 남아요." confirmLabel="삭제"
          onConfirm={() => { applyLink({ kind: 'remove', id: confirmLinkId }); closeLinkConfirm(); }} onCancel={closeLinkConfirm} />
      )}
      {editing && (
        <EditSheet key={editing.id} card={editing} update={update} remove={remove} onClose={() => setEditingId(null)} />
      )}
    </>
  );
}

const THEMES = { system: '🌗', light: '☀️', dark: '🌙' } as const;
const THEME_LABEL = { system: '시스템 테마', light: '라이트 모드', dark: '다크 모드' } as const;
type Theme = keyof typeof THEMES;

// 시스템 → 라이트 → 다크 순환. 초기 적용은 index.html 인라인 스크립트가 깜빡임 없이 처리
function ThemeButton() {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme as Theme) || 'system');
  const next = () => {
    const t: Theme = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
    if (t === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
    try { localStorage.setItem('theme', t); } catch { /* 저장 불가해도 이번 세션엔 적용됨 */ }
    setTheme(t);
  };
  return <button aria-label={`${THEME_LABEL[theme]} (눌러서 변경)`} title={THEME_LABEL[theme]} onClick={next}>{THEMES[theme]}</button>;
}
