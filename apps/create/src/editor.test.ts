import assert from "node:assert/strict";
import { forceLocalSections } from "./editor.js";
import type { Edition, SourceArticle } from "./types.js";

const localArticle: SourceArticle = {
  title: "Town council approves budget",
  link: "https://local.example/news/town-budget?utm_source=rss",
  source: "Local Example",
  publishedAt: "2026-08-24T12:00:00Z",
  isLocal: true
};

const edition: Edition = {
  date: "2026-08-24",
  lead: {
    section: "U.S.",
    headline: "Budget story",
    dek: "A local budget story.",
    body: ["A local budget story."],
    sourceLinks: ["https://local.example/news/town-budget#comments"]
  },
  briefing: [{
    section: "U.S.",
    headline: "Brief budget story",
    dek: "A local budget brief.",
    body: ["A local budget brief."],
    sourceLinks: ["https://local.example/news/town-budget"]
  }],
  sections: {
    LOCAL: [],
    "U.S.": [{
      section: "U.S.",
      headline: "Main budget story",
      dek: "A local budget main story.",
      body: ["A local budget main story."],
      sourceLinks: ["https://local.example/news/town-budget?ref=homepage"]
    }]
  },
  puzzleWords: []
};

forceLocalSections(edition, [localArticle]);

assert.equal(edition.lead.section, "LOCAL");
assert.equal(edition.briefing[0].section, "LOCAL");
assert.equal(edition.sections["U.S."].length, 0);
assert.equal(edition.sections.LOCAL.length, 1);
assert.equal(edition.sections.LOCAL[0].section, "LOCAL");
