import OpenAI from "openai";
import type { Edition, SourceArticle } from "./types.js";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("Model did not return JSON");
  return JSON.parse(candidate.slice(start, end + 1));
}

export async function createEdition(date: string, articles: SourceArticle[]): Promise<Edition> {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required");

  const compact = articles.map((a, i) => ({
    id: i,
    title: a.title,
    source: a.source,
    publishedAt: a.publishedAt,
    summary: (a.summary || "").slice(0, 700),
    link: a.link
  }));

  const prompt = `
Create an original daily newspaper digest for ${date} from the supplied feed metadata.

Rules:
- Do not reproduce article text or distinctive headlines.
- Rewrite every headline.
- Summaries must be original and based only on supplied facts.
- If feed metadata is insufficient for a claim, omit the claim.
- Prefer important hard news, then business/technology/science/culture/sports.
- Create 1 lead story, 5-8 short briefing stories, and exactly 4 additional main stories across the sections.
- Briefing stories should be short: headline, dek, and at most 1 brief body paragraph.
- Each main story should have 5-6 concise body paragraphs of 35-55 words each.
- Make the lead and each main story substantial enough to fill a compact newspaper column layout.
- Put at most 2 stories in any single section array; leave lower-priority sections empty.
- sourceLinks must contain only URLs supplied in the input.
- puzzleWords: 12 uppercase words, 4-10 letters, drawn from neutral concepts in today's coverage.
- Return JSON only.

Schema:
{
  "date": "YYYY-MM-DD",
  "lead": {"section":"","headline":"","dek":"","body":[""],"sourceLinks":[""]},
  "briefing": [{"section":"","headline":"","dek":"","body":[""],"sourceLinks":[""]}],
  "sections": {
    "WORLD": [],
    "U.S.": [],
    "BUSINESS": [],
    "TECHNOLOGY": [],
    "SCIENCE & HEALTH": [],
    "CULTURE": [],
    "SPORTS": []
  },
  "puzzleWords": []
}

Feed metadata:
${JSON.stringify(compact)}
`;

  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5.6",
    input: prompt
  });

  const parsed = extractJson(response.output_text) as Edition;
  parsed.date = date;
  return parsed;
}
