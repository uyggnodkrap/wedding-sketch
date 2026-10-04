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
