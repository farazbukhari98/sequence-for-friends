import { describe, it, expect } from 'vitest';
import {
  BOARD_LAYOUT,
  CORNER_POSITIONS,
  getJackType,
  isCorner,
  findCardPositions,
  isDeadCard,
  TEAM_COLORS,
  DIFFICULTY_INFO,
} from '@/constants/board';

describe('BOARD_LAYOUT', () => {
  it('is a 10x10 grid', () => {
    expect(BOARD_LAYOUT).toHaveLength(10);
    for (const row of BOARD_LAYOUT) {
      expect(row).toHaveLength(10);
    }
  });

  it('has wild corners at (0,0), (0,9), (9,0), (9,9)', () => {
    expect(BOARD_LAYOUT[0][0]).toBe('W');
    expect(BOARD_LAYOUT[0][9]).toBe('W');
    expect(BOARD_LAYOUT[9][0]).toBe('W');
    expect(BOARD_LAYOUT[9][9]).toBe('W');
  });

  it('contains valid card codes in non-corner cells', () => {
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        const cell = BOARD_LAYOUT[r][c];
        if (cell === 'W') continue;
        // Each card code should be 2 characters (e.g. '2S', 'AH')
        expect(cell).toHaveLength(2);
      }
    }
  });
});

describe('CORNER_POSITIONS', () => {
  it('contains exactly 4 corners', () => {
    expect(CORNER_POSITIONS).toHaveLength(4);
  });

  it('matches the W cells in BOARD_LAYOUT', () => {
    for (const [r, c] of CORNER_POSITIONS) {
      expect(BOARD_LAYOUT[r][c]).toBe('W');
    }
  });
});

describe('getJackType', () => {
  it('identifies two-eyed jacks', () => {
    expect(getJackType('JD')).toBe('two-eyed');
    expect(getJackType('JC')).toBe('two-eyed');
  });

  it('identifies one-eyed jacks', () => {
    expect(getJackType('JH')).toBe('one-eyed');
    expect(getJackType('JS')).toBe('one-eyed');
  });

  it('returns null for non-jack cards', () => {
    expect(getJackType('AS')).toBeNull();
    expect(getJackType('2H')).toBeNull();
    expect(getJackType('TC')).toBeNull();
    expect(getJackType('W')).toBeNull();
  });
});

describe('isCorner', () => {
  it('returns true for corner positions', () => {
    expect(isCorner(0, 0)).toBe(true);
    expect(isCorner(0, 9)).toBe(true);
    expect(isCorner(9, 0)).toBe(true);
    expect(isCorner(9, 9)).toBe(true);
  });

  it('returns false for non-corner positions', () => {
    expect(isCorner(0, 1)).toBe(false);
    expect(isCorner(5, 5)).toBe(false);
    expect(isCorner(1, 1)).toBe(false);
  });
});

describe('findCardPositions', () => {
  it('finds all positions of a card on the board', () => {
    const positions = findCardPositions('AS');
    // AS appears on the board — check it finds at least one
    expect(positions.length).toBeGreaterThan(0);
    // Verify each position matches the card in BOARD_LAYOUT
    for (const [r, c] of positions) {
      expect(BOARD_LAYOUT[r][c]).toBe('AS');
    }
  });

  it('returns empty array for a card not on the board', () => {
    const positions = findCardPositions('ZZ');
    expect(positions).toEqual([]);
  });
});

describe('isDeadCard', () => {
  it('jacks are never dead', () => {
    const emptyBoard = Array.from({ length: 10 }, () => Array(10).fill(null));
    expect(isDeadCard('JH', emptyBoard)).toBe(false);
    expect(isDeadCard('JD', emptyBoard)).toBe(false);
    expect(isDeadCard('JC', emptyBoard)).toBe(false);
    expect(isDeadCard('JS', emptyBoard)).toBe(false);
  });

  it('a card is dead when all its positions are occupied', () => {
    // Create a board where all positions for a card are filled
    const fullBoard = Array.from({ length: 10 }, () => Array(10).fill(0));
    // Every cell has a chip, so any regular card should be dead
    expect(isDeadCard('AS', fullBoard)).toBe(true);
  });

  it('a card is not dead when at least one position is empty', () => {
    const emptyBoard = Array.from({ length: 10 }, () => Array(10).fill(null));
    expect(isDeadCard('AS', emptyBoard)).toBe(false);
  });
});

describe('TEAM_COLORS', () => {
  it('has blue, green, and red teams', () => {
    expect(TEAM_COLORS).toHaveProperty('blue');
    expect(TEAM_COLORS).toHaveProperty('green');
    expect(TEAM_COLORS).toHaveProperty('red');
  });

  it('each team has hex and letter properties', () => {
    for (const key of ['blue', 'green', 'red']) {
      const team = TEAM_COLORS[key];
      expect(team).toHaveProperty('hex');
      expect(team).toHaveProperty('letter');
      expect(team.hex).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});

describe('DIFFICULTY_INFO', () => {
  it('has easy, medium, hard, and impossible difficulties', () => {
    expect(DIFFICULTY_INFO).toHaveProperty('easy');
    expect(DIFFICULTY_INFO).toHaveProperty('medium');
    expect(DIFFICULTY_INFO).toHaveProperty('hard');
    expect(DIFFICULTY_INFO).toHaveProperty('impossible');
  });

  it('each difficulty has emoji, color, and label', () => {
    for (const key of ['easy', 'medium', 'hard', 'impossible']) {
      const diff = DIFFICULTY_INFO[key];
      expect(diff).toHaveProperty('emoji');
      expect(diff).toHaveProperty('color');
      expect(diff).toHaveProperty('label');
      expect(typeof diff.label).toBe('string');
    }
  });
});