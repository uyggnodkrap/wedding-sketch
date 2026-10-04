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
