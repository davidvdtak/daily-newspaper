import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { collectNews } from "./news.js";
import { createEdition } from "./editor.js";
import { makeSudoku } from "./puzzles.js";
import { renderPdf } from "./pdf.js";

const s3 = new S3Client({});

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

export const handler = async () => {
  const bucket = process.env.BUCKET;
  if (!bucket) throw new Error("BUCKET is required");

  const date = process.env.EDITION_DATE ||
    yesterdayInTimezone(process.env.TIMEZONE || "America/New_York");

  const articles = await collectNews(date);
  if (!articles.length) throw new Error(`No feed articles found for ${date}`);

  const edition = await createEdition(date, articles);
  const sudoku = makeSudoku();
  const pdf = await renderPdf(edition, sudoku);

  const prefix = (process.env.PREFIX || "").replace(/^\/+/, "");
  const key = `${prefix}${date} - Daily Newspaper.pdf`;

  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: pdf,
    ContentType: "application/pdf",
    Metadata: { editionDate: date }
  }));

  return { statusCode: 200, bucket, key, bytes: pdf.length, articleCandidates: articles.length };
};
