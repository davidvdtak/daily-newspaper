import type { MiniCrossword, MiniCrosswordDraft } from "./types.js";

export type Sudoku = { puzzle: number[][]; solution: number[][] };

function shuffled<T>(arr: T[]) {
  return [...arr].sort(() => Math.random() - 0.5);
}

function valid(board: number[][], row: number, col: number, n: number) {
  for (let i = 0; i < 9; i++) {
    if (board[row][i] === n || board[i][col] === n) return false;
  }
  const br = Math.floor(row / 3) * 3, bc = Math.floor(col / 3) * 3;
  for (let r = br; r < br + 3; r++)
    for (let c = bc; c < bc + 3; c++)
      if (board[r][c] === n) return false;
  return true;
}

function fill(board: number[][], pos = 0): boolean {
  if (pos === 81) return true;
  const r = Math.floor(pos / 9), c = pos % 9;
  if (board[r][c]) return fill(board, pos + 1);
  for (const n of shuffled([1,2,3,4,5,6,7,8,9])) {
    if (valid(board, r, c, n)) {
      board[r][c] = n;
      if (fill(board, pos + 1)) return true;
      board[r][c] = 0;
    }
  }
  return false;
}

export function makeSudoku(): Sudoku {
  const solution = Array.from({ length: 9 }, () => Array(9).fill(0));
  fill(solution);
  const puzzle = solution.map(r => [...r]);
  for (const i of shuffled(Array.from({ length: 81 }, (_, i) => i)).slice(0, 50)) {
    puzzle[Math.floor(i / 9)][i % 9] = 0;
  }
  return { puzzle, solution };
}

const MINI_CROSSWORD_BANK = [
  {
    rows: ["WALL", "AREA", "LEAD", "LADY"],
    acrossClues: ["Boundary or barrier", "Region or section", "Top story position", "Polite term for a woman"],
    downClues: ["Part of a room", "Space on a map", "Go first", "Formal counterpart of gentleman"]
  },
  {
    rows: ["SAND", "AREA", "NEAR", "DART"],
    acrossClues: ["Beach grains", "Part of a map", "Close by", "Move quickly"],
    downClues: ["Material in an hourglass", "Measured space", "Not far", "Small pointed game piece"]
  },
  {
    rows: ["BALL", "AREA", "LEAD", "LADY"],
    acrossClues: ["Round game object", "Measured space", "Go first", "Formal counterpart of gentleman"],
    downClues: ["Formal dance", "Part of a chart", "Top article", "Polite form of address"]
  }
];

function dateIndex(date: string, modulo: number) {
  const compact = date.replace(/\D/g, "");
  const n = Number(compact || "0");
  return Math.abs(n) % modulo;
}

export function makeMiniCrossword(date: string): MiniCrossword {
  const source = MINI_CROSSWORD_BANK[dateIndex(date, MINI_CROSSWORD_BANK.length)];
  const grid = source.rows.map((row) => row.split(""));
  return buildMiniCrossword(grid, source.acrossClues, source.downClues);
}

function cleanClue(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed || fallback;
}

function cleanAnswer(value: unknown) {
  return typeof value === "string" ? value.replace(/[^A-Za-z]/g, "").toUpperCase() : "";
}

function buildMiniCrossword(grid: string[][], acrossClues: string[], downClues: string[]): MiniCrossword {
  const entries: MiniCrossword["entries"] = [];
  let nextNumber = 1;

  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      const startsAcross = col === 0;
      const startsDown = row === 0;
      if (!startsAcross && !startsDown) continue;

      const number = nextNumber++;
      if (startsAcross) {
        const answer = grid[row].join("");
        entries.push({
          number,
          direction: "Across",
          row,
          col,
          answer,
          clue: cleanClue(acrossClues[row], `${answer.length}-letter answer`)
        });
      }
      if (startsDown) {
        const answer = grid.map((r) => r[col]).join("");
        entries.push({
          number,
          direction: "Down",
          row,
          col,
          answer,
          clue: cleanClue(downClues[col], `${answer.length}-letter answer`)
        });
      }
    }
  }

  return { grid, entries };
}

export function normalizeMiniCrossword(draft: MiniCrosswordDraft | undefined, date: string): MiniCrossword {
  if (!draft || !Array.isArray(draft.grid) || !Array.isArray(draft.across) || !Array.isArray(draft.down)) {
    return makeMiniCrossword(date);
  }

  const rows = draft.grid.map((row) => typeof row === "string" ? row.trim().toUpperCase() : "");
  const validGrid = rows.length === 4 && rows.every((row) => /^[A-Z]{4}$/.test(row));
  if (!validGrid || draft.across.length < 4 || draft.down.length < 4) {
    return makeMiniCrossword(date);
  }

  const downAnswers = rows[0].split("").map((_, col) => rows.map((row) => row[col]).join(""));
  const acrossMatches = draft.across.slice(0, 4).every((entry, i) => cleanAnswer(entry?.answer) === rows[i]);
  const downMatches = draft.down.slice(0, 4).every((entry, i) => cleanAnswer(entry?.answer) === downAnswers[i]);
  if (!acrossMatches || !downMatches) {
    return makeMiniCrossword(date);
  }

  const acrossClues = draft.across.slice(0, 4).map((entry, i) =>
    cleanClue(entry?.clue, `${rows[i].length}-letter answer`)
  );
  const downClues = draft.down.slice(0, 4).map((entry, i) =>
    cleanClue(entry?.clue, `${downAnswers[i].length}-letter answer`)
  );

  return buildMiniCrossword(rows.map((row) => row.split("")), acrossClues, downClues);
}
