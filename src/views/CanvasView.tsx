import { useRef, useState } from 'react';
import type { Card } from '../cards/types';
import { CardView } from '../cards/CardView';
import { isDrag, startsGesture, type View } from './geometry';

type Gesture =
  | { kind: 'pan'; pointerId: number; sx: number; sy: number; ox: number; oy: number }
  | { kind: 'card'; pointerId: number; id: string; sx: number; sy: number; ox: number; oy: number; x: number; y: number; moved: boolean };

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
    if (g.current || !startsGesture(e)) return; // 두 번째 손가락, 오른쪽 클릭 무시
    const target = e.target as HTMLElement;
    if (target.closest('a')) return; // 링크 탭은 그대로 통과
    const id = target.closest<HTMLElement>('[data-card-id]')?.dataset.cardId;
    const card = id ? cards.find(c => c.id === id) : undefined;
    e.currentTarget.setPointerCapture(e.pointerId);
    g.current = card
      ? { kind: 'card', pointerId: e.pointerId, id: card.id, sx: e.clientX, sy: e.clientY, ox: card.x, oy: card.y, x: card.x, y: card.y, moved: false }
      : { kind: 'pan', pointerId: e.pointerId, sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const cur = g.current;
    if (cur?.pointerId !== e.pointerId) return;
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

  const onPointerUp = (e: React.PointerEvent) => {
    const cur = g.current;
    if (cur?.pointerId !== e.pointerId) return;
    g.current = null;
    if (cur?.kind !== 'card') return;
    if (!cur.moved) return onTap(cur.id);
    onMove(cur.id, cur.x, cur.y);
    setDrag(null);
    setDragging(null);
  };

  const onPointerCancel = (e: React.PointerEvent) => {
    if (g.current?.pointerId !== e.pointerId) return;
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
