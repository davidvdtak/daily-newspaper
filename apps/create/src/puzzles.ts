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
