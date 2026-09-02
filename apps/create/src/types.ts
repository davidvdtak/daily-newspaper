export type SourceArticle = {
  title: string;
  link: string;
  source: string;
  publishedAt: string;
  summary?: string;
  isLocal?: boolean;
};

export type ReaderStory = {
  section: string;
  headline: string;
  dek: string;
  body: string[];
  sourceLinks: string[];
};

export type CrosswordDirection = "Across" | "Down";

export type CrosswordEntry = {
  number: number;
  direction: CrosswordDirection;
  row: number;
  col: number;
  answer: string;
  clue: string;
};

export type MiniCrossword = {
  grid: string[][];
  entries: CrosswordEntry[];
};

export type MiniCrosswordDraft = {
  grid: string[];
  across: { answer: string; clue: string }[];
  down: { answer: string; clue: string }[];
};

export type Edition = {
  date: string;
  lead: ReaderStory;
  briefing: ReaderStory[];
  sections: Record<string, ReaderStory[]>;
  puzzleWords: string[];
  miniCrossword?: MiniCrosswordDraft;
};
