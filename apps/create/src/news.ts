import Parser from "rss-parser";
import type { SourceArticle } from "./types.js";

const parser = new Parser();

const DEFAULT_FEEDS = [
  "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
  "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
  "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml",
  "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml"
];

function localFeeds() {
  return (process.env.LOCAL_NEWS_RSS_URLS || "")
    .split(",")
    .map(v => v.trim())
    .filter(Boolean);
}

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function collectNews(targetDate: string): Promise<SourceArticle[]> {
  const localUrls = localFeeds();
  const urls = [
    ...(process.env.NEWS_RSS_URLS || DEFAULT_FEEDS.join(","))
      .split(",")
      .map(v => v.trim())
      .filter(Boolean)
      .map(url => ({ url, isLocal: false })),
    ...localUrls.map(url => ({ url, isLocal: true }))
  ];

  const results = await Promise.allSettled(urls.map(async ({ url, isLocal }) => {
    const feed = await parser.parseURL(url);
    return (feed.items || []).map(item => ({
      title: item.title || "Untitled",
      link: item.link || "",
      source: feed.title || new URL(url).hostname,
      publishedAt: item.isoDate || item.pubDate || "",
      summary: item.contentSnippet || item.content || "",
      isLocal
    } satisfies SourceArticle));
  }));

  const all = results.flatMap(r => r.status === "fulfilled" ? r.value : []);
  const exact = all.filter(a => {
    const d = new Date(a.publishedAt);
    return !Number.isNaN(d.getTime()) && dateKey(d) === targetDate;
  });

  // Deduplicate by URL/title. If feeds lag across midnight, allow recent feed items.
  const source = exact.length >= 8 ? exact : all;
  const seen = new Set<string>();
  return source.filter(a => {
    const k = a.link || a.title.toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 140);
}
