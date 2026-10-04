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
