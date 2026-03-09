import {
  BoardChips,
  SequenceLine,
  SequenceLength,
  isCorner,
  cellKey,
  DEFAULT_SEQUENCE_LENGTH,
} from '../../../shared/types.js';

// Direction vectors for checking sequences
// [rowDelta, colDelta]
const DIRECTIONS: [number, number][] = [
  [0, 1],   // Horizontal right
  [1, 0],   // Vertical down
  [1, 1],   // Diagonal down-right
  [1, -1],  // Diagonal down-left
];

/**
 * Check if a cell is occupied by a team (including corners which count for all)
 */
function isCellOccupiedByTeam(
  boardChips: BoardChips,
  row: number,
  col: number,
  teamIndex: number
): boolean {
  // Corners count for everyone
  if (isCorner(row, col)) return true;

  // Check if this cell has this team's chip
  return boardChips[row][col] === teamIndex;
}

/**
 * Check if a position is valid on the board
 */
function isValidPosition(row: number, col: number): boolean {
  return row >= 0 && row < 10 && col >= 0 && col < 10;
}

/**
 * Find all sequences of N+ for a team starting from a given position in a direction
 */
function findSequenceInDirection(
  boardChips: BoardChips,
  startRow: number,
  startCol: number,
  dRow: number,
  dCol: number,
  teamIndex: number,
  sequenceLength: SequenceLength
): [number, number][] | null {
  const cells: [number, number][] = [];

  let row = startRow;
  let col = startCol;

  // Collect consecutive cells in this direction
  while (isValidPosition(row, col) && isCellOccupiedByTeam(boardChips, row, col, teamIndex)) {
    cells.push([row, col]);
    row += dRow;
    col += dCol;
  }

  // Need at least sequenceLength to be a sequence
  if (cells.length >= sequenceLength) {
    return cells.slice(0, sequenceLength); // Return exactly sequenceLength cells
  }

  return null;
}

/**
 * Get all possible sequence lines that pass through a specific cell
 */
export function getSequencesThroughCell(
  boardChips: BoardChips,
  targetRow: number,
  targetCol: number,
  teamIndex: number,
  sequenceLength: SequenceLength = DEFAULT_SEQUENCE_LENGTH
): SequenceLine[] {
  const sequences: SequenceLine[] = [];
  const maxLookBack = sequenceLength - 1;

  for (const [dRow, dCol] of DIRECTIONS) {
    // Find the start of potential sequence (go backwards up to sequenceLength-1 cells)
    let startRow = targetRow;
    let startCol = targetCol;

    for (let i = 0; i < maxLookBack; i++) {
      const prevRow = startRow - dRow;
      const prevCol = startCol - dCol;

      if (!isValidPosition(prevRow, prevCol)) break;
      if (!isCellOccupiedByTeam(boardChips, prevRow, prevCol, teamIndex)) break;

      startRow = prevRow;
      startCol = prevCol;
    }

    // Now find all N-cell sequences starting from this extended start
    let row = startRow;
    let col = startCol;
    const line: [number, number][] = [];

    while (isValidPosition(row, col) && isCellOccupiedByTeam(boardChips, row, col, teamIndex)) {
      line.push([row, col]);
      row += dRow;
      col += dCol;
    }

    // Check all possible N-cell windows that include our target cell
    if (line.length >= sequenceLength) {
      for (let start = 0; start <= line.length - sequenceLength; start++) {
        const window = line.slice(start, start + sequenceLength);
        // Check if target cell is in this window
        if (window.some(([r, c]) => r === targetRow && c === targetCol)) {
          sequences.push({
            cells: window,
            teamIndex,
          });
        }
      }
    }
  }

  return sequences;
}

/**
 * Check if a sequence overlaps too much with existing locked cells
 */
function isValidSequenceOverlap(
  sequence: SequenceLine,
  lockedCells: Set<string>
): boolean {
  let nonCornerOverlap = 0;

  for (const [row, col] of sequence.cells) {
    if (isCorner(row, col)) continue;

    if (lockedCells.has(cellKey(row, col))) {
      nonCornerOverlap++;
    }
  }

  return nonCornerOverlap <= 1;
}

function countNonCornerCells(sequence: SequenceLine): number {
  let count = 0;

  for (const [row, col] of sequence.cells) {
    if (!isCorner(row, col)) {
      count++;
    }
  }

  return count;
}

function countCornerCells(sequence: SequenceLine): number {
  return sequence.cells.length - countNonCornerCells(sequence);
}

function getSequenceKey(sequence: SequenceLine): string {
  const sortedCells = [...sequence.cells].sort((a, b) =>
    a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]
  );

  return sortedCells.map(([row, col]) => `${row},${col}`).join('|');
}

function countSharedNonCornerCells(a: SequenceLine, b: SequenceLine): number {
  const cells = new Set<string>();

  for (const [row, col] of a.cells) {
    if (!isCorner(row, col)) {
      cells.add(cellKey(row, col));
    }
  }

  let shared = 0;
  for (const [row, col] of b.cells) {
    if (!isCorner(row, col) && cells.has(cellKey(row, col))) {
      shared++;
    }
  }

  return shared;
}

function isAllLocked(sequence: SequenceLine, lockedCells: Set<string>): boolean {
  return sequence.cells.every(([row, col]) =>
    lockedCells.has(cellKey(row, col)) || isCorner(row, col)
  );
}

function compareIndexLists(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);

  for (let i = 0; i < length; i++) {
    if (a[i] !== b[i]) {
      return a[i] - b[i];
    }
  }

  return a.length - b.length;
}

function chooseBestSequenceSubset(candidates: SequenceLine[]): SequenceLine[] {
  if (candidates.length <= 1) {
    return candidates;
  }

  const totalMasks = 1 << candidates.length;
  const nonCornerCounts = candidates.map(countNonCornerCells);
  const cornerCounts = candidates.map(countCornerCells);

  let bestIndices: number[] = [];
  let bestSequenceCount = 0;
  let bestNonCornerCells = -1;
  let bestCornerCells = Infinity;

  for (let mask = 1; mask < totalMasks; mask++) {
    const selectedIndices: number[] = [];
    let totalNonCornerCells = 0;
    let totalCornerCells = 0;
    let valid = true;

    for (let i = 0; i < candidates.length; i++) {
      if ((mask & (1 << i)) === 0) continue;

      for (const previousIndex of selectedIndices) {
        if (countSharedNonCornerCells(candidates[i], candidates[previousIndex]) > 1) {
          valid = false;
          break;
        }
      }

      if (!valid) break;

      selectedIndices.push(i);
      totalNonCornerCells += nonCornerCounts[i];
      totalCornerCells += cornerCounts[i];
    }

    if (!valid) continue;

    const isBetter =
      selectedIndices.length > bestSequenceCount ||
      (
        selectedIndices.length === bestSequenceCount &&
        (
          totalNonCornerCells > bestNonCornerCells ||
          (
            totalNonCornerCells === bestNonCornerCells &&
            (
              totalCornerCells < bestCornerCells ||
              (
                totalCornerCells === bestCornerCells &&
                compareIndexLists(selectedIndices, bestIndices) < 0
              )
            )
          )
        )
      );

    if (isBetter) {
      bestIndices = selectedIndices;
      bestSequenceCount = selectedIndices.length;
      bestNonCornerCells = totalNonCornerCells;
      bestCornerCells = totalCornerCells;
    }
  }

  return bestIndices.map(index => candidates[index]);
}

/**
 * Find all valid new sequences that pass through a newly placed chip
 */
export function detectNewSequences(
  boardChips: BoardChips,
  targetRow: number,
  targetCol: number,
  teamIndex: number,
  lockedCells: Set<string>,
  sequencesCompleted: number,
  sequencesToWin: number,
  sequenceLength: SequenceLength = DEFAULT_SEQUENCE_LENGTH
): SequenceLine[] {
  const potentialSequences = getSequencesThroughCell(boardChips, targetRow, targetCol, teamIndex, sequenceLength);
  const newSequences: SequenceLine[] = [];
  const seenKeys = new Set<string>();

  for (const seq of potentialSequences) {
    if (isAllLocked(seq, lockedCells)) continue;

    if (sequencesCompleted > 0) {
      if (!isValidSequenceOverlap(seq, lockedCells)) {
        continue;
      }
    }

    const key = getSequenceKey(seq);

    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      newSequences.push(seq);
    }
  }

  return chooseBestSequenceSubset(newSequences);
}

/**
 * Check if a cell is part of a locked sequence
 */
export function isCellLocked(
  lockedCells: Map<number, Set<string>>,
  row: number,
  col: number
): boolean {
  for (const [, cells] of lockedCells) {
    if (cells.has(cellKey(row, col))) {
      return true;
    }
  }
  return false;
}

/**
 * Lock cells of a completed sequence
 */
export function lockSequenceCells(
  lockedCells: Map<number, Set<string>>,
  sequence: SequenceLine
): void {
  const teamCells = lockedCells.get(sequence.teamIndex) || new Set<string>();

  for (const [row, col] of sequence.cells) {
    if (!isCorner(row, col)) {
      teamCells.add(cellKey(row, col));
    }
  }

  lockedCells.set(sequence.teamIndex, teamCells);
}
