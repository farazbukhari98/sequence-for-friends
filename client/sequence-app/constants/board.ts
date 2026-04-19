// Board layout and card rules for Sequence
import type { CardCode } from '@/types/game';

// Official Sequence 10x10 board layout
// 'W' = Wild corner (counts for all teams)
export const BOARD_LAYOUT: string[][] = [
  ['W',  '2S', '3S', '4S', '5S', '6S', '7S', '8S', '9S', 'W' ],
  ['6C', '5C', '4C', '3C', '2C', 'AH', 'KH', 'QH', 'TH', 'TS'],
  ['7C', 'AS', '2D', '3D', '4D', '5D', '6D', '7D', '9H', 'QS'],
  ['8C', 'KS', '6C', '5C', '4C', '3C', '2C', '8D', '8H', 'KS'],
  ['9C', 'QS', '7C', '6H', '5H', '4H', 'AH', '9D', '7H', 'AS'],
  ['TC', 'TS', '8C', '7H', '2H', '3H', 'KH', 'TD', '6H', '2D'],
  ['QC', '9S', '9C', '8H', '9H', 'TH', 'QH', 'QD', '5H', '3D'],
  ['KC', '8S', 'TC', 'QC', 'KC', 'AC', 'AD', 'KD', '4H', '4D'],
  ['AC', '7S', '6S', '5S', '4S', '3S', '2S', '2H', '3H', '5D'],
  ['W',  'AD', 'KD', 'QD', 'TD', '9D', '8D', '7D', '6D', 'W' ],
];

// Corner positions (wild cells)
export const CORNER_POSITIONS: [number, number][] = [
  [0, 0], [0, 9], [9, 0], [9, 9]
];

// Jack definitions
export const TWO_EYED_JACKS: CardCode[] = ['JD', 'JC'];
export const ONE_EYED_JACKS: CardCode[] = ['JH', 'JS'];

export type JackType = 'two-eyed' | 'one-eyed';

export function getJackType(card: string): JackType | null {
  if (TWO_EYED_JACKS.includes(card as CardCode)) return 'two-eyed';
  if (ONE_EYED_JACKS.includes(card as CardCode)) return 'one-eyed';
  return null;
}

export function isCorner(row: number, col: number): boolean {
  return CORNER_POSITIONS.some(([r, c]) => r === row && c === col);
}

export function findCardPositions(card: string): [number, number][] {
  const positions: [number, number][] = [];
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 10; col++) {
      if (BOARD_LAYOUT[row][col] === card) {
        positions.push([row, col]);
      }
    }
  }
  return positions;
}

export function isDeadCard(card: string, boardChips: (number | null)[][]): boolean {
  // Jacks can never be dead
  if (card.startsWith('J')) return false;
  const positions = findCardPositions(card);
  return positions.every(([r, c]) => boardChips[r][c] !== null);
}

export function getHighlightedCells(
  selectedCard: string | null,
  state: { boardChips: (number | null)[][]; lastRemovedCell: number[] | null; lockedCells: string[][]; players: { id: string; teamIndex: number }[]; currentPlayerIndex: number },
  playerId: string
): Set<string> {
  if (!selectedCard) return new Set();
  const currentPlayer = state.players[state.currentPlayerIndex];
  if (!currentPlayer || currentPlayer.id !== playerId) return new Set();

  const myTeamIndex = state.players.find(p => p.id === playerId)?.teamIndex ?? -1;

  const locked = new Set<string>();
  state.lockedCells.forEach(row => row.forEach(cell => locked.add(cell)));

  switch (getJackType(selectedCard)) {
    case 'two-eyed':
      // Can place on any empty non-corner cell
      const emptyCells = new Set<string>();
      for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 10; col++) {
          if (isCorner(row, col)) continue;
          if (state.boardChips[row][col] !== null) continue;
          if (state.lastRemovedCell && state.lastRemovedCell[0] === row && state.lastRemovedCell[1] === col) continue;
          emptyCells.add(`${row},${col}`);
        }
      }
      return emptyCells;

    case 'one-eyed':
      // Can remove opponent's chips (not locked)
      const removableCells = new Set<string>();
      for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 10; col++) {
          if (isCorner(row, col)) continue;
          const chip = state.boardChips[row][col];
          if (chip === null) continue;
          if (chip === myTeamIndex) continue;
          if (locked.has(`${row},${col}`)) continue;
          removableCells.add(`${row},${col}`);
        }
      }
      return removableCells;

    default:
      // Regular card - show available positions
      return new Set(
        findCardPositions(selectedCard).filter(([r, c]) => state.boardChips[r][c] === null).map(([r, c]) => `${r},${c}`)
      );
  }
}

// Team color display helpers
export const TEAM_COLORS: Record<string, { hex: string; letter: string }> = {
  blue: { hex: '#2980b9', letter: 'B' },
  green: { hex: '#27ae60', letter: 'G' },
  red: { hex: '#c0392b', letter: 'R' },
};

// Difficulty display helpers
export const DIFFICULTY_INFO: Record<string, { emoji: string; color: string; label: string }> = {
  easy: { emoji: '🟢', color: '#22c55e', label: 'Easy' },
  medium: { emoji: '🟡', color: '#eab308', label: 'Medium' },
  hard: { emoji: '🔴', color: '#ef4444', label: 'Hard' },
  impossible: { emoji: '💀', color: '#a855f7', label: 'Impossible' },
};