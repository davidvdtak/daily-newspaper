import PDFDocument from "pdfkit/js/pdfkit.standalone.js";
import type { Edition, ReaderStory } from "./types.js";
import type { Sudoku } from "./puzzles.js";

const PAGE_W = 540, PAGE_H = 720;
const M = 34;
const FOOTER_Y = PAGE_H - M - 8;
const ARTICLE_TOP = 48;
const ARTICLE_BOTTOM = PAGE_H - 44;
const ARTICLE_GAP = 14;
const ARTICLE_COL_W = (PAGE_W - M*2 - ARTICLE_GAP) / 2;

function pageHeader(doc: PDFKit.PDFDocument, label: string, date: string) {
  doc.font("Helvetica-Bold").fontSize(8).text(label, M, 20);
  doc.font("Helvetica").fontSize(8).text(date, M, 20, { width: PAGE_W - M*2, align: "right" });
  doc.moveTo(M, 32).lineTo(PAGE_W-M, 32).lineWidth(.5).stroke();
}

function pageFooter(doc: PDFKit.PDFDocument, date: string, page: number) {
  doc.font("Helvetica").fontSize(7).text(
    `THE DAILY NEWSPAPER • ${date} • ${page}`,
    M,
    FOOTER_Y,
    {
      width: PAGE_W - M*2,
      height: 9,
      align: "center",
      lineBreak: false
    }
  );
}

function masthead(doc: PDFKit.PDFDocument, date: string) {
  doc.font("Times-Bold").fontSize(30).text("THE DAILY NEWSPAPER", M, 42, { align: "center" });
  doc.font("Helvetica").fontSize(8).text("INDEPENDENT MORNING EDITION • BUILT FOR E-INK", M, 78, { align: "center" });
  doc.moveTo(M, 96).lineTo(PAGE_W-M, 96).lineWidth(1.3).stroke();
  doc.font("Times-Roman").fontSize(10).text(date, M, 102, { align: "center" });
}

function story(doc: PDFKit.PDFDocument, s: ReaderStory, x: number, y: number, w: number, maxH: number) {
  const start = y;
  doc.font("Helvetica-Bold").fontSize(7).text(s.section.toUpperCase(), x, y, { width: w });
  y = doc.y + 3;
  doc.font("Times-Bold").fontSize(15).text(s.headline, x, y, { width: w, lineGap: 1 });
  y = doc.y + 4;
  doc.font("Times-Italic").fontSize(9).text(s.dek, x, y, { width: w, lineGap: 1 });
  y = doc.y + 5;
  for (const p of s.body) {
    if (doc.y > start + maxH - 35) break;
    doc.font("Times-Roman").fontSize(9.4).text(p, x, doc.y, { width: w, lineGap: 2 });
    doc.moveDown(.45);
  }
  return doc.y;
}

type ColumnCursor = {
  x: number;
  y: number;
  col: 0 | 1;
};

function nextArticleColumn(doc: PDFKit.PDFDocument, cursor: ColumnCursor, date: string) {
  if (cursor.col === 0) {
    cursor.col = 1;
    cursor.x = M + ARTICLE_COL_W + ARTICLE_GAP;
    cursor.y = ARTICLE_TOP;
    return;
  }

  doc.addPage();
  pageHeader(doc, "ARTICLES", date);
  cursor.col = 0;
  cursor.x = M;
  cursor.y = ARTICLE_TOP;
}

function ensureArticleSpace(doc: PDFKit.PDFDocument, cursor: ColumnCursor, height: number, date: string) {
  if (cursor.y + height > ARTICLE_BOTTOM) nextArticleColumn(doc, cursor, date);
}

function textHeight(doc: PDFKit.PDFDocument, text: string, width: number, font: string, size: number, lineGap = 0) {
  doc.font(font).fontSize(size);
  return doc.heightOfString(text || " ", { width, lineGap });
}

function articleIntroHeight(doc: PDFKit.PDFDocument, s: ReaderStory) {
  return 7 +
    textHeight(doc, s.section.toUpperCase(), ARTICLE_COL_W, "Helvetica-Bold", 7) + 3 +
    textHeight(doc, s.headline, ARTICLE_COL_W, "Times-Bold", 14, 1) + 4 +
    textHeight(doc, s.dek, ARTICLE_COL_W, "Times-Italic", 9, 1) + 7;
}

function drawFullStory(doc: PDFKit.PDFDocument, s: ReaderStory, cursor: ColumnCursor, date: string) {
  ensureArticleSpace(doc, cursor, articleIntroHeight(doc, s), date);

  doc.font("Helvetica-Bold").fontSize(7).text(s.section.toUpperCase(), cursor.x, cursor.y, { width: ARTICLE_COL_W });
  cursor.y = doc.y + 3;
  doc.font("Times-Bold").fontSize(14).text(s.headline, cursor.x, cursor.y, { width: ARTICLE_COL_W, lineGap: 1 });
  cursor.y = doc.y + 4;
  doc.font("Times-Italic").fontSize(9).text(s.dek, cursor.x, cursor.y, { width: ARTICLE_COL_W, lineGap: 1 });
  cursor.y = doc.y + 7;

  for (const p of s.body) {
    const h = textHeight(doc, p, ARTICLE_COL_W, "Times-Roman", 9.2, 1.5) + 6;
    ensureArticleSpace(doc, cursor, h, date);
    doc.font("Times-Roman").fontSize(9.2).text(p, cursor.x, cursor.y, { width: ARTICLE_COL_W, lineGap: 1.5 });
    cursor.y = doc.y + 6;
  }

  cursor.y += 8;
}

function mainStories(edition: Edition) {
  const sections = Object.values(edition.sections).flat()
    .filter((s) => s.headline && s.body?.length);
  const fallback = edition.briefing
    .filter((s) => s.headline && s.body?.length)
    .map((s) => ({ ...s, section: s.section || "BRIEFING" }));

  return sections.length >= 22 ? sections.slice(0, 22) : [...sections, ...fallback].slice(0, 22);
}

function articlePages(doc: PDFKit.PDFDocument, edition: Edition) {
  const stories = mainStories(edition);
  if (!stories.length) return;

  doc.addPage();
  pageHeader(doc, "ARTICLES", edition.date);

  const cursor: ColumnCursor = { x: M, y: ARTICLE_TOP, col: 0 };
  for (const s of stories) drawFullStory(doc, s, cursor, edition.date);
}

function drawSudoku(doc: PDFKit.PDFDocument, grid: number[][], x: number, y: number, size: number, answers=false) {
  const cell = size / 9;
  for (let i=0;i<=9;i++) {
    doc.lineWidth(i%3===0 ? 1.4 : .35);
    doc.moveTo(x+i*cell,y).lineTo(x+i*cell,y+size).stroke();
    doc.moveTo(x,y+i*cell).lineTo(x+size,y+i*cell).stroke();
  }
  for (let r=0;r<9;r++) for (let c=0;c<9;c++) {
    const n=grid[r][c];
    if (n) doc.font("Helvetica").fontSize(11).text(String(n), x+c*cell, y+r*cell+6, { width: cell, align:"center" });
  }
}

function puzzlePage(doc: PDFKit.PDFDocument, edition: Edition, sudoku: Sudoku) {
  doc.addPage();
  pageHeader(doc, "PUZZLES", edition.date);
  doc.font("Times-Bold").fontSize(26).text("Puzzles", M, 48);
  doc.font("Times-Bold").fontSize(17).text("Daily Sudoku", M, 92);
  drawSudoku(doc, sudoku.puzzle, M, 120, 300);

  doc.font("Times-Bold").fontSize(17).text("Word Scramble", 360, 92);
  doc.font("Times-Roman").fontSize(9).text("Unscramble these words from today's edition.", 360, 116, { width: 145 });
  let y=150;
  for (const w of edition.puzzleWords.slice(0, 12)) {
    const scrambled = w.split("").sort(()=>Math.random()-.5).join("");
    doc.font("Helvetica-Bold").fontSize(10).text(scrambled, 360, y, { width: 145 });
    doc.moveTo(360,y+18).lineTo(490,y+18).lineWidth(.35).stroke();
    y += 34;
  }

  doc.addPage();
  pageHeader(doc, "ANSWERS", edition.date);
  doc.font("Times-Bold").fontSize(26).text("Answers", M, 48);
  doc.font("Times-Bold").fontSize(17).text("Sudoku", M, 92);
  drawSudoku(doc, sudoku.solution, M, 120, 300, true);
  doc.font("Times-Bold").fontSize(17).text("Word Scramble", 360, 92);
  y=126;
  edition.puzzleWords.slice(0,12).forEach((w,i)=>{
    doc.font("Helvetica").fontSize(10).text(`${i+1}. ${w}`, 360, y, { width:145 }); y+=22;
  });
}

export async function renderPdf(edition: Edition, sudoku: Sudoku): Promise<Buffer> {
  const doc = new PDFDocument({
    size: [PAGE_W, PAGE_H],
    margins: { top: M, bottom: M, left: M, right: M },
    bufferPages: true,
    info: { Title: `The Daily Newspaper - ${edition.date}`, Author: "Editor Daily Newspaper" }
  });

  const chunks: Buffer[] = [];
  doc.on("data", c => chunks.push(Buffer.from(c)));

  masthead(doc, edition.date);
  story(doc, edition.lead, M, 128, PAGE_W-M*2, 280);

  doc.moveTo(M, 415).lineTo(PAGE_W-M, 415).lineWidth(.7).stroke();
  doc.font("Helvetica-Bold").fontSize(8).text("THE BRIEFING", M, 426);
  const briefs = edition.briefing.slice(0, 8);
  let y = 445;
  briefs.forEach((b, i) => {
    const x = i % 2 === 0 ? M : PAGE_W/2 + 6;
    if (i % 2 === 0 && i > 0) y += 58;
    doc.font("Times-Bold").fontSize(10).text(b.headline, x, y, { width: 220 });
    doc.font("Times-Roman").fontSize(8).text(b.dek, x, doc.y+2, { width: 220, height: 30, ellipsis: true });
  });

  articlePages(doc, edition);

  if (process.env.INCLUDE_PUZZLES === "true") puzzlePage(doc, edition, sudoku);

  const range = doc.bufferedPageRange();
  for (let i=0; i<range.count; i++) {
    doc.switchToPage(i);
    pageFooter(doc, edition.date, i+1);
  }
  const finalRange = doc.bufferedPageRange();
  if (finalRange.count !== range.count) {
    throw new Error(`Footer rendering unexpectedly changed page count from ${range.count} to ${finalRange.count}`);
  }

  doc.end();
  return await new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}
