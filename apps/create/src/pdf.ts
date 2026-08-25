import PDFDocument from "pdfkit/js/pdfkit.standalone.js";
import type { Edition, ReaderStory } from "./types.js";
import type { Sudoku } from "./puzzles.js";

const PAGE_W = 540, PAGE_H = 720;
const M = 34;

function pageHeader(doc: PDFKit.PDFDocument, label: string, date: string) {
  doc.font("Helvetica-Bold").fontSize(8).text(label, M, 20);
  doc.font("Helvetica").fontSize(8).text(date, M, 20, { width: PAGE_W - M*2, align: "right" });
  doc.moveTo(M, 32).lineTo(PAGE_W-M, 32).lineWidth(.5).stroke();
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

function sectionPage(doc: PDFKit.PDFDocument, title: string, stories: ReaderStory[], date: string) {
  doc.addPage();
  pageHeader(doc, title, date);
  doc.font("Times-Bold").fontSize(26).text(title, M, 48);
  doc.moveTo(M, 82).lineTo(PAGE_W-M, 82).lineWidth(1).stroke();

  const gap = 14, colW = (PAGE_W - M*2 - gap) / 2;
  let leftY = 96, rightY = 96;
  for (const s of stories.slice(0, 5)) {
    const useLeft = leftY <= rightY;
    const x = useLeft ? M : M + colW + gap;
    const y = useLeft ? leftY : rightY;
    const next = story(doc, s, x, y, colW, 560) + 12;
    if (useLeft) leftY = next; else rightY = next;
    if (Math.min(leftY, rightY) > 650) break;
  }
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
  story(doc, edition.lead, M, 128, PAGE_W-M*2, 300);

  doc.moveTo(M, 435).lineTo(PAGE_W-M, 435).lineWidth(.7).stroke();
  doc.font("Helvetica-Bold").fontSize(8).text("THE BRIEFING", M, 446);
  const briefs = edition.briefing.slice(0, 6);
  let y = 465;
  briefs.forEach((b, i) => {
    const x = i % 2 === 0 ? M : PAGE_W/2 + 6;
    if (i % 2 === 0 && i > 0) y += 66;
    doc.font("Times-Bold").fontSize(10).text(b.headline, x, y, { width: 220 });
    doc.font("Times-Roman").fontSize(8).text(b.dek, x, doc.y+2, { width: 220, height: 34, ellipsis: true });
  });

  for (const [name, stories] of Object.entries(edition.sections)) {
    if (stories?.length) sectionPage(doc, name, stories, edition.date);
  }

  puzzlePage(doc, edition, sudoku);

  const range = doc.bufferedPageRange();
  for (let i=0; i<range.count; i++) {
    doc.switchToPage(i);
    doc.font("Helvetica").fontSize(7).text(
      `THE DAILY NEWSPAPER • ${edition.date} • ${i+1}`,
      M, PAGE_H-22, { width: PAGE_W-M*2, align: "center" }
    );
  }

  doc.end();
  return await new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}
