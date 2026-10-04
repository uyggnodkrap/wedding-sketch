export type Card = {
  id: string;
  text: string;
  url: string | null;
  done: boolean;
  x: number;
  y: number;
  sort_order: number;
  author_id: string;
  created_at: string;
  updated_at: string;
};

export type CardsState = Record<string, Card>;
