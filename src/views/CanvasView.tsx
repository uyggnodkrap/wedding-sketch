import { useRef, useState } from 'react';
import type { Card, Link } from '../cards/types';
import { CardView } from '../cards/CardView';
import { arrowTip, CARD_W, isDrag, startsGesture, type View } from './geometry';

const CARD_H_EST = 60; // 측정 전 첫 렌더용
const ARROW_GAP = -1; // 화살촉 끝을 카드 밑으로 1px 넣어 틈 없이 붙임 (카드가 SVG 위에 그려져 가려짐)

type Gesture =
  | { kind: 'pan'; pointerId: number; sx: number; sy: number; ox: number; oy: number; moved: boolean }
  | { kind: 'card'; pointerId: number; id: string; sx: number; sy: number; ox: number; oy: number; x: number; y: number; moved: boolean };

type Props = {
  cards: Card[];
  links: Link[];
  selectedId: string | null; // 연결 모드에서 출발 카드로 고른 카드
  onBackgroundTap: () => void;
  view: View;
  setView: (v: View) => void;
  colorOf: (authorId: string) => string;
  onMove: (id: string, x: number, y: number) => void;
  onTap: (id: string) => void;
  setDragging: (id: string | null) => void;
};

export function CanvasView({ cards, links, selectedId, onBackgroundTap, view, setView, colorOf, onMove, onTap, setDragging }: Props) {
  const g = useRef<Gesture | null>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  // 카드 높이는 내용마다 달라 실제로 측정 (화살촉을 도착 카드 테두리에 붙이기 위해)
  const [heights, setHeights] = useState<Record<string, number>>({});
  const [observer] = useState(() => new ResizeObserver(entries => setHeights(h => {
    const next = { ...h };
    for (const e of entries) next[(e.target as HTMLElement).dataset.cardId!] = e.contentRect.height;
    return next;
  })));

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (g.current || !startsGesture(e)) return; // 두 번째 손가락, 오른쪽 클릭 무시
    const target = e.target as HTMLElement;
    if (target.closest('a')) return; // 링크 탭은 그대로 통과
    const id = target.closest<HTMLElement>('[data-card-id]')?.dataset.cardId;
    const card = id ? cards.find(c => c.id === id) : undefined;
    e.currentTarget.setPointerCapture(e.pointerId);
    g.current = card
      ? { kind: 'card', pointerId: e.pointerId, id: card.id, sx: e.clientX, sy: e.clientY, ox: card.x, oy: card.y, x: card.x, y: card.y, moved: false }
      : { kind: 'pan', pointerId: e.pointerId, sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const cur = g.current;
    if (cur?.pointerId !== e.pointerId) return;
    const dx = e.clientX - cur.sx;
    const dy = e.clientY - cur.sy;
    if (cur.kind === 'pan') {
      if (!cur.moved && !isDrag(dx, dy)) return;
      cur.moved = true;
      return setView({ ...view, x: cur.ox + dx, y: cur.oy + dy });
    }
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
    if (cur?.kind === 'pan' && !cur.moved) return onBackgroundTap();
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

  // 드래그 중인 카드는 손가락 위치 기준으로 선이 따라오게
  const center: Record<string, { x: number; y: number }> = {};
  for (const c of cards) {
    const pos = drag?.id === c.id ? drag : c;
    center[c.id] = { x: pos.x + CARD_W / 2, y: pos.y + (heights[c.id] ?? CARD_H_EST) / 2 };
  }

  return (
    <div className="canvas" onPointerDown={onPointerDown} onPointerMove={onPointerMove}
      onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}>
      <div className="canvas-layer" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}>
        <svg className="links" width="1" height="1" aria-hidden="true">
          {links.map(l => {
            const a = center[l.from_id];
            const b = center[l.to_id];
            if (!a || !b) return null;
            const tip = arrowTip(a, b, CARD_W / 2 + ARROW_GAP, (heights[l.to_id] ?? CARD_H_EST) / 2 + ARROW_GAP);
            return (
              <g key={l.id}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
                {l.style === 'arrow' && <polygon points="-16,-7 0,0 -16,7" transform={`translate(${tip.x} ${tip.y}) rotate(${tip.angle})`} />}
              </g>
            );
          })}
        </svg>
        {cards.map(c => {
          const pos = drag?.id === c.id ? drag : c;
          return (
            <div key={c.id} data-card-id={c.id} ref={el => { if (!el) return; observer.observe(el); return () => observer.unobserve(el); }}
              className={c.id === selectedId ? 'canvas-card selected' : 'canvas-card'}
              style={{ left: pos.x, top: pos.y }}>
              <CardView card={c} color={colorOf(c.author_id)} />
            </div>
          );
        })}
      </div>
      {cards.length === 0 && <p className="empty">"새 메모"를 눌러 첫 아이디어를 적어 보세요</p>}
    </div>
  );
}
