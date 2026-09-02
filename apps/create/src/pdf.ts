import PDFDocument from "pdfkit/js/pdfkit.standalone.js";
import type { Edition, MiniCrossword, ReaderStory } from "./types.js";
import { normalizeMiniCrossword, type Sudoku } from "./puzzles.js";

const PAGE_W = 540, PAGE_H = 720;
const M = 34;
const FOOTER_Y = PAGE_H - M - 8;
const CONTENT_BOTTOM = FOOTER_Y - 12;
const ARTICLE_TOP = 48;
const ARTICLE_BOTTOM = CONTENT_BOTTOM;
const ARTICLE_GAP = 14;
const ARTICLE_COL_W = (PAGE_W - M*2 - ARTICLE_GAP) / 2;
const SECTION_LABEL_SIZE = 8;
const FRONT_HEADLINE_SIZE = 17;
const ARTICLE_HEADLINE_SIZE = 16;
const DEK_SIZE = 10.5;
const FRONT_BODY_SIZE = 11;
const ARTICLE_BODY_SIZE = 10.8;
const BODY_LINE_GAP = 2.4;
const BRIEF_HEADLINE_SIZE = 11.5;
const BRIEF_DEK_SIZE = 9.5;
const BRIEF_START_Y = 445;
const BRIEF_ROW_GAP = 56;
const BRIEF_COL_W = 220;
const BRIEF_HEADLINE_HEIGHT = 26;
const BRIEF_DEK_OFFSET = 28;
const BRIEF_DEK_HEIGHT = 24;

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
  const bottom = start + maxH;
  doc.font("Helvetica-Bold").fontSize(SECTION_LABEL_SIZE).text((s.section || "NEWS").toUpperCase(), x, y, { width: w });
  y = doc.y + 3;
  doc.font("Times-Bold").fontSize(FRONT_HEADLINE_SIZE).text(s.headline || "Untitled", x, y, { width: w, lineGap: 1 });
  y = doc.y + 4;
  doc.font("Times-Italic").fontSize(DEK_SIZE).text(s.dek || "", x, y, { width: w, lineGap: 1 });
  y = doc.y + 5;
  for (const p of s.body) {
    const remaining = bottom - doc.y;
    if (remaining <= FRONT_BODY_SIZE) break;
    doc.font("Times-Roman").fontSize(FRONT_BODY_SIZE).text(p, x, doc.y, {
      width: w,
      height: remaining,
      lineGap: BODY_LINE_GAP,
      ellipsis: true
    });
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

function fitTextToHeight(
  doc: PDFKit.PDFDocument,
  text: string,
  width: number,
  font: string,
  size: number,
  lineGap: number,
  height: number
) {
  const words = text.trim().split(/\s+/);
  if (!words.length || height <= 0) return { fit: "", rest: text };

  let lo = 1;
  let hi = words.length;
  let best = 0;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const candidate = words.slice(0, mid).join(" ");
    if (textHeight(doc, candidate, width, font, size, lineGap) <= height) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  if (!best) return { fit: "", rest: text };
  return {
    fit: words.slice(0, best).join(" "),
    rest: words.slice(best).join(" ")
  };
}

function textHeight(doc: PDFKit.PDFDocument, text: string, width: number, font: string, size: number, lineGap = 0) {
  doc.font(font).fontSize(size);
  return doc.heightOfString(text || " ", { width, lineGap });
}

function articleIntroHeight(doc: PDFKit.PDFDocument, s: ReaderStory) {
  return SECTION_LABEL_SIZE +
    textHeight(doc, (s.section || "NEWS").toUpperCase(), ARTICLE_COL_W, "Helvetica-Bold", SECTION_LABEL_SIZE) + 3 +
    textHeight(doc, s.headline || "Untitled", ARTICLE_COL_W, "Times-Bold", ARTICLE_HEADLINE_SIZE, 1) + 4 +
    textHeight(doc, s.dek || "", ARTICLE_COL_W, "Times-Italic", DEK_SIZE, 1) + 7;
}

function drawFullStory(doc: PDFKit.PDFDocument, s: ReaderStory, cursor: ColumnCursor, date: string) {
  ensureArticleSpace(doc, cursor, articleIntroHeight(doc, s), date);

  doc.font("Helvetica-Bold").fontSize(SECTION_LABEL_SIZE).text((s.section || "NEWS").toUpperCase(), cursor.x, cursor.y, { width: ARTICLE_COL_W });
  cursor.y = doc.y + 3;
  doc.font("Times-Bold").fontSize(ARTICLE_HEADLINE_SIZE).text(s.headline || "Untitled", cursor.x, cursor.y, { width: ARTICLE_COL_W, lineGap: 1 });
  cursor.y = doc.y + 4;
  doc.font("Times-Italic").fontSize(DEK_SIZE).text(s.dek || "", cursor.x, cursor.y, { width: ARTICLE_COL_W, lineGap: 1 });
  cursor.y = doc.y + 7;

  for (const p of s.body) {
    let remainingText = p;
    while (remainingText.trim()) {
      const paragraphHeight = textHeight(doc, remainingText, ARTICLE_COL_W, "Times-Roman", ARTICLE_BODY_SIZE, BODY_LINE_GAP);
      const fullColumnHeight = ARTICLE_BOTTOM - ARTICLE_TOP;
      const requiredHeight = paragraphHeight + 7 <= fullColumnHeight
        ? paragraphHeight + 7
        : Math.min(paragraphHeight, fullColumnHeight);
      ensureArticleSpace(doc, cursor, requiredHeight, date);

      const availableHeight = ARTICLE_BOTTOM - cursor.y;
      if (paragraphHeight <= availableHeight) {
        doc.font("Times-Roman").fontSize(ARTICLE_BODY_SIZE).text(remainingText, cursor.x, cursor.y, { width: ARTICLE_COL_W, lineGap: BODY_LINE_GAP });
        cursor.y = Math.min(doc.y + 7, ARTICLE_BOTTOM);
        break;
      }

      const { fit, rest } = fitTextToHeight(
        doc,
        remainingText,
        ARTICLE_COL_W,
        "Times-Roman",
        ARTICLE_BODY_SIZE,
        BODY_LINE_GAP,
        availableHeight
      );
      if (!fit) {
        nextArticleColumn(doc, cursor, date);
        continue;
      }

      doc.font("Times-Roman").fontSize(ARTICLE_BODY_SIZE).text(fit, cursor.x, cursor.y, { width: ARTICLE_COL_W, lineGap: BODY_LINE_GAP });
      remainingText = rest;
      nextArticleColumn(doc, cursor, date);
    }
  }

  cursor.y += 8;
}

function isLocalStory(s: ReaderStory) {
  return (s.section || "").toUpperCase() === "LOCAL";
}

function localStoriesLast(stories: ReaderStory[], limit: number) {
  const local = stories.filter(isLocalStory);
  const nonLocal = stories.filter((s) => !isLocalStory(s));
  const localCount = Math.min(local.length, limit);

  return [
    ...nonLocal.slice(0, limit - localCount),
    ...local.slice(0, localCount)
  ];
}

function mainStories(edition: Edition) {
  const sections = Object.values(edition.sections).flat()
    .filter((s) => s?.headline && Array.isArray(s.body) && s.body.length);
  const fallback = edition.briefing
    .filter((s) => s?.headline && Array.isArray(s.body) && s.body.length)
    .map((s) => ({ ...s, section: s.section || "BRIEFING" }));
  const candidates = sections.length >= 22 ? sections : [...sections, ...fallback];

  return localStoriesLast(candidates, 22);
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

function drawMiniCrossword(doc: PDFKit.PDFDocument, crossword: MiniCrossword, x: number, y: number, size: number, answers = false) {
  const cell = size / crossword.grid.length;
  const numberedCells = new Map<string, number>();

  for (const entry of crossword.entries) {
    numberedCells.set(`${entry.row},${entry.col}`, entry.number);
  }

  for (let r = 0; r < crossword.grid.length; r++) {
    for (let c = 0; c < crossword.grid[r].length; c++) {
      const cellX = x + c * cell;
      const cellY = y + r * cell;
      doc.rect(cellX, cellY, cell, cell).fillAndStroke("white", "black");

      const number = numberedCells.get(`${r},${c}`);
      if (number) {
        doc.font("Helvetica").fontSize(6.5).fillColor("black").text(String(number), cellX + 3, cellY + 3, {
          width: cell - 6,
          lineBreak: false
        });
      }

      if (answers) {
        doc.font("Helvetica-Bold").fontSize(16).fillColor("black").text(crossword.grid[r][c], cellX, cellY + cell / 2 - 8, {
          width: cell,
          align: "center",
          lineBreak: false
        });
      }
    }
  }

  doc.fillColor("black");
}

function drawCrosswordClues(doc: PDFKit.PDFDocument, crossword: MiniCrossword, x: number, y: number, showAnswers = false) {
  const across = crossword.entries.filter((entry) => entry.direction === "Across");
  const down = crossword.entries.filter((entry) => entry.direction === "Down");

  doc.font("Times-Bold").fontSize(13).text("Across", x, y);
  let cursorY = doc.y + 6;
  for (const entry of across) {
    const text = showAnswers
      ? `${entry.number}. ${entry.answer} - ${entry.clue}`
      : `${entry.number}. ${entry.clue}`;
    doc.font("Times-Roman").fontSize(9.5).text(text, x, cursorY, { width: 170, height: 24, ellipsis: true });
    cursorY = doc.y + 5;
  }

  cursorY += 8;
  doc.font("Times-Bold").fontSize(13).text("Down", x, cursorY);
  cursorY = doc.y + 6;
  for (const entry of down) {
    const text = showAnswers
      ? `${entry.number}. ${entry.answer} - ${entry.clue}`
      : `${entry.number}. ${entry.clue}`;
    doc.font("Times-Roman").fontSize(9.5).text(text, x, cursorY, { width: 170, height: 24, ellipsis: true });
    cursorY = doc.y + 5;
  }
}

function isOddEditionDay(date: string) {
  const day = Number(date.split("-")[2]);
  return Number.isFinite(day) && day % 2 === 1;
}

function sudokuPuzzlePage(doc: PDFKit.PDFDocument, edition: Edition, sudoku: Sudoku) {
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

function crosswordPuzzlePage(doc: PDFKit.PDFDocument, edition: Edition) {
  const crossword = normalizeMiniCrossword(edition.miniCrossword, edition.date);

  doc.addPage();
  pageHeader(doc, "PUZZLES", edition.date);
  doc.font("Times-Bold").fontSize(26).text("Puzzles", M, 48);
  doc.font("Times-Bold").fontSize(17).text("Mini Crossword", M, 92);
  drawMiniCrossword(doc, crossword, M, 124, 260);
  drawCrosswordClues(doc, crossword, 330, 110);

  doc.addPage();
  pageHeader(doc, "ANSWERS", edition.date);
  doc.font("Times-Bold").fontSize(26).text("Answers", M, 48);
  doc.font("Times-Bold").fontSize(17).text("Mini Crossword", M, 92);
  drawMiniCrossword(doc, crossword, M, 124, 260, true);
  drawCrosswordClues(doc, crossword, 330, 110, true);
}

function puzzlePage(doc: PDFKit.PDFDocument, edition: Edition, sudoku: Sudoku) {
  if (isOddEditionDay(edition.date)) {
    sudokuPuzzlePage(doc, edition, sudoku);
    return;
  }

  crosswordPuzzlePage(doc, edition);
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
  const briefs = edition.briefing.filter((b) => !isLocalStory(b)).slice(0, 8);
  briefs.forEach((b, i) => {
    const x = i % 2 === 0 ? M : PAGE_W/2 + 6;
    const y = BRIEF_START_Y + Math.floor(i / 2) * BRIEF_ROW_GAP;
    doc.font("Times-Bold").fontSize(BRIEF_HEADLINE_SIZE).text(
      b.headline,
      x,
      y,
      { width: BRIEF_COL_W, height: BRIEF_HEADLINE_HEIGHT, ellipsis: true }
    );
    doc.font("Times-Roman").fontSize(BRIEF_DEK_SIZE).text(
      b.dek,
      x,
      y + BRIEF_DEK_OFFSET,
      { width: BRIEF_COL_W, height: BRIEF_DEK_HEIGHT, ellipsis: true }
    );
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
