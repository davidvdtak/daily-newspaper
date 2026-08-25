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

export type Edition = {
  date: string;
  lead: ReaderStory;
  briefing: ReaderStory[];
  sections: Record<string, ReaderStory[]>;
  puzzleWords: string[];
};
