import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { collectNews } from "./news.js";
import { createEdition } from "./editor.js";
import { makeSudoku } from "./puzzles.js";
import { renderPdf } from "./pdf.js";

let currentStep = "starting";

function setStep(step: string) {
  currentStep = step;
  console.log(`[preview] ${step}`);
}

function yesterdayInTimezone(tz: string) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(now);
  const obj = Object.fromEntries(parts.map(p => [p.type, p.value]));
  const localToday = new Date(`${obj.year}-${obj.month}-${obj.day}T12:00:00Z`);
  localToday.setUTCDate(localToday.getUTCDate() - 1);
  return localToday.toISOString().slice(0,10);
}

function formatDuration(ms: number) {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (!minutes) return `${seconds}s`;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

async function main() {
  const date = process.env.EDITION_DATE || yesterdayInTimezone(process.env.TIMEZONE || "America/New_York");
  const output = resolve(process.env.PREVIEW_OUTPUT || `preview/${date} - Daily Newspaper.pdf`);
  const heartbeat = setInterval(() => {
    console.log(`[preview] still working: ${currentStep}`);
  }, 10000);

  const startedAt = performance.now();

  try {
    setStep(`collecting news for ${date}`);
    const articles = await collectNews(date);
    if (!articles.length) throw new Error(`No feed articles found for ${date}`);

    setStep(`creating edition from ${articles.length} article candidates`);
    const edition = await createEdition(date, articles);

    setStep("rendering PDF");
    const pdf = await renderPdf(edition, makeSudoku());

    setStep(`writing ${output}`);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, pdf);

    clearInterval(heartbeat);
    console.log(JSON.stringify({
      output,
      bytes: pdf.length,
      articleCandidates: articles.length,
      timeToCompletion: formatDuration(performance.now() - startedAt)
    }, null, 2));
  } catch (err) {
    clearInterval(heartbeat);
    throw err;
  }
}

await main();
