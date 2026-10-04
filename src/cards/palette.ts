// 카드 동그라미(실링 도장) 색. 라이트/다크 카드 모두에서 작은 점으로 보이는 중간 명도
export const PALETTE = [
  { key: 'rose', name: '장미', hex: '#c98a8f' },
  { key: 'wax', name: '와인', hex: '#9e3b4a' },
  { key: 'apricot', name: '살구', hex: '#e0a174' },
  { key: 'mustard', name: '겨자', hex: '#c9a43e' },
  { key: 'olive', name: '올리브', hex: '#7c8558' },
  { key: 'sage', name: '세이지', hex: '#8fae9b' },
  { key: 'dusty', name: '하늘', hex: '#7c97b8' },
  { key: 'lavender', name: '라벤더', hex: '#a08cc0' },
] as const;

export type PaletteKey = (typeof PALETTE)[number]['key'];

export const paletteHex = (key: PaletteKey) => PALETTE.find(p => p.key === key)!.hex;
// DB 값은 아무 문자열일 수 있으므로 모르는 key면 undefined
export const cardHex = (key: string | null) => PALETTE.find(p => p.key === key)?.hex;
