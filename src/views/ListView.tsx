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
