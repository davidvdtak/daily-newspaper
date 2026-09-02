import OpenAI from "openai";
import type { Edition, ReaderStory, SourceArticle } from "./types.js";

function openAiClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("Model did not return JSON");
  return JSON.parse(candidate.slice(start, end + 1));
}

function sameLink(a: string, b: string) {
  const normalize = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "";

    try {
      const url = new URL(trimmed);
      url.hash = "";
      url.search = "";
      return `${url.origin}${url.pathname.replace(/\/$/, "")}`;
    } catch {
      return trimmed.replace(/[#?].*$/, "").replace(/\/$/, "");
    }
  };

  return normalize(a) === normalize(b);
}

function usesLocalSource(story: ReaderStory, localLinks: string[]) {
  return (story.sourceLinks || []).some(link =>
    localLinks.some(localLink => sameLink(link, localLink))
  );
}

export function forceLocalSections(edition: Edition, articles: SourceArticle[]) {
  const localLinks = articles
    .filter(a => a.isLocal && a.link)
    .map(a => a.link);
  if (!localLinks.length) return;

  const mark = (story: ReaderStory) => {
    if (usesLocalSource(story, localLinks)) story.section = "LOCAL";
  };

  mark(edition.lead);
  edition.briefing?.forEach(mark);
  for (const stories of Object.values(edition.sections || {})) {
    stories?.forEach(mark);
  }

  const localStories: ReaderStory[] = [];
  for (const [section, stories] of Object.entries(edition.sections || {})) {
    if (section === "LOCAL") continue;
    edition.sections[section] = stories.filter(story => {
      if (story.section !== "LOCAL") return true;
      localStories.push(story);
      return false;
    });
  }
  edition.briefing = (edition.briefing || []).filter(story => {
    if (story.section !== "LOCAL") return true;
    localStories.push(story);
    return false;
  });
  edition.sections.LOCAL = [...localStories, ...(edition.sections.LOCAL || [])];
}

export async function createEdition(date: string, articles: SourceArticle[]): Promise<Edition> {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required");

  const compact = articles.map((a, i) => ({
    id: i,
    title: a.title,
    source: a.source,
    publishedAt: a.publishedAt,
    summary: (a.summary || "").slice(0, 700),
    link: a.link,
    isLocal: Boolean(a.isLocal)
  }));

  const prompt = `
Create an original daily newspaper digest for ${date} from the supplied feed metadata.

Rules:
- Do not reproduce article text or distinctive headlines.
- Rewrite every headline.
- Summaries must be original and based only on supplied facts.
- If feed metadata is insufficient for a claim, omit the claim.
- Prefer important hard news, then business/technology/science/culture/sports.
- Articles marked isLocal=true came from LOCAL_NEWS_RSS_URLS.
- Use section "LOCAL" for every story primarily based on isLocal=true articles; do not label local feed stories as "U.S.".
- Local feed stories must be main stories in sections.LOCAL only. Do not use local feed stories for briefing stories.
- Create 1 lead story, 10-14 short briefing stories, and 18-22 additional main stories across the sections.
- Every story object must include non-empty section, headline, dek, body, and sourceLinks fields.
- Briefing stories should be short: headline, dek, and at most 1 brief body paragraph.
- The lead story should have 7-9 concise body paragraphs of 45-65 words each.
- Each main story should have 5-7 concise body paragraphs of 45-65 words each.
- Make the lead and each main story substantial enough to fill a compact newspaper column layout.
- Put 2-4 main stories in each populated section array, spread across all available sections when possible.
- sourceLinks must contain only URLs supplied in the input.
- puzzleWords: 12 uppercase words, 4-10 letters, drawn from neutral concepts in today's coverage.
- miniCrossword: create one compact 4x4 crossword for even-day editions.
- miniCrossword.grid must be exactly 4 strings of 4 uppercase A-Z letters, with no spaces or punctuation.
- miniCrossword.across must have exactly 4 answer/clue objects, one for each grid row in order.
- miniCrossword.down must have exactly 4 answer/clue objects, one for each grid column in order.
- Each across answer must exactly match its grid row; each down answer must exactly match its grid column.
- Crossword clues should be short, fair, and must not include or directly reveal the answer.
- Return JSON only.

Schema:
{
  "date": "YYYY-MM-DD",
  "lead": {"section":"","headline":"","dek":"","body":[""],"sourceLinks":[""]},
  "briefing": [{"section":"","headline":"","dek":"","body":[""],"sourceLinks":[""]}],
  "sections": {
    "LOCAL": [],
    "WORLD": [],
    "U.S.": [],
    "BUSINESS": [],
    "TECHNOLOGY": [],
    "SCIENCE & HEALTH": [],
    "CULTURE": [],
    "SPORTS": []
  },
  "puzzleWords": [],
  "miniCrossword": {
    "grid": ["WORD", "WORD", "WORD", "WORD"],
    "across": [{"answer":"WORD","clue":""}, {"answer":"WORD","clue":""}, {"answer":"WORD","clue":""}, {"answer":"WORD","clue":""}],
    "down": [{"answer":"WORD","clue":""}, {"answer":"WORD","clue":""}, {"answer":"WORD","clue":""}, {"answer":"WORD","clue":""}]
  }
}

Feed metadata:
${JSON.stringify(compact)}
`;

  const response = await openAiClient().responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5.6",
    input: prompt
  });

  const parsed = extractJson(response.output_text) as Edition;
  parsed.date = date;
  forceLocalSections(parsed, articles);
  return parsed;
}
