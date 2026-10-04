export type Card = {
  id: string;
  text: string;
  url: string | null;
  color: string | null; // palette.ts key, null이면 작성자 색
  done: boolean;
  x: number;
  y: number;
  sort_order: number;
  author_id: string;
  created_at: string;
  updated_at: string;
};

export type CardsState = Record<string, Card>;

export type LinkStyle = 'line' | 'arrow';

export type Link = {
  id: string;
  from_id: string;
  to_id: string;
  style: LinkStyle;
  created_at: string;
};

export type LinksState = Record<string, Link>;
