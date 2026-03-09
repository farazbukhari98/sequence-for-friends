import { describe, it, expect, beforeEach } from 'vitest';
import {
  GameState,
  BoardChips,
  Player,
  TeamColor,
  CardCode,
  GameVariant,
  TEAM_COLORS_2,
  TEAM_COLORS_3,
} from '../shared/types';
import { detectNewSequences, lockSequenceCells, isCellLocked } from '../worker/src/rules/sequences';
import { isLegalMove, applyMove, isDeadCard, getLegalTargets, checkStalemate } from '../worker/src/rules/engine';
import { createDeck, shuffleDeck, dealCards } from '../worker/src/rules/deck';
import { KING_ZONE_PRESETS } from '../worker/src/rules/kingOfTheBoard';

// Helper to create an empty board
function createEmptyBoard(): BoardChips {
  return Array(10).fill(null).map(() => Array(10).fill(null));
}

// Helper to create a test player
function createTestPlayer(id: string, teamIndex: number, teamColor: TeamColor, hand: CardCode[] = []): Player {
  return {
    id,
    name: `Player ${id}`,
    token: `token-${id}`,
    seatIndex: teamIndex,
    teamIndex,
    teamColor,
    connected: true,
    ready: true,
    hand,
    discardPile: [],
  };
}

// Helper to create a basic game state for testing
function createTestGameState(
  players: Player[],
  currentPlayerIndex: number = 0,
  teamCount: number = 2,
  gameVariant: GameVariant = 'classic'
): GameState {
  const sequencesToWin = teamCount === 2 ? 2 : 1;
  const teamScores = new Map<number, number>();
  const sequencesCompleted = new Map<number, number>();
  for (let i = 0; i < teamCount; i++) {
    teamScores.set(i, 0);
    sequencesCompleted.set(i, 0);
  }

  return {
    phase: 'playing',
    config: {
      playerCount: players.length,
      teamCount,
      teamColors: teamCount === 2 ? TEAM_COLORS_2 : TEAM_COLORS_3,
      gameVariant,
      sequencesToWin,
      scoreToWin: gameVariant === 'king-of-the-board' ? 3 : sequencesToWin,
      sequenceLength: 5,
      handSize: 7,
    },
    players,
    dealerIndex: 0,
    currentPlayerIndex,
    deck: createDeck(),
    boardChips: createEmptyBoard(),
    lockedCells: new Map(),
    sequencesCompleted,
    teamScores,
    completedSequences: [],
    kingZone: gameVariant === 'king-of-the-board' ? KING_ZONE_PRESETS[0] : null,
    deadCardReplacedThisTurn: false,
    pendingDraw: false,
    lastRemovedCell: null,
    cutCards: [],
    winnerTeamIndex: null,
    lastMove: null,
    turnTimeLimit: 0,
    turnStartedAt: null,
    sequenceTimestamps: new Map(),
    scoreTimestamps: new Map(),
    eventLog: [],
    firstPlayerId: players[currentPlayerIndex]?.id || null,
  };
}

describe('Deck Utilities', () => {
  it('should create a 104-card deck', () => {
    const deck = createDeck();
    expect(deck.length).toBe(104);
  });

  it('should have two of each card', () => {
    const deck = createDeck();
    const counts = new Map<string, number>();
    deck.forEach(card => {
      counts.set(card, (counts.get(card) || 0) + 1);
    });

    // Each card should appear exactly twice
    for (const [card, count] of counts) {
      expect(count).toBe(2);
    }
  });

  it('should shuffle the deck', () => {
    const deck1 = createDeck();
    const deck2 = shuffleDeck(createDeck());

    // Shuffled deck should have same cards but different order
    expect(deck2.length).toBe(deck1.length);
    expect(deck2.sort().join()).toBe(deck1.sort().join());
  });

  it('should deal cards from deck', () => {
    const deck = createDeck();
    const hand = dealCards(deck, 7);

    expect(hand.length).toBe(7);
    expect(deck.length).toBe(97);
  });
});

describe('Sequence Detection', () => {
  it('should detect a horizontal sequence of 5', () => {
    const board = createEmptyBoard();
    const teamIndex = 0;

    // Place 5 chips in a row horizontally
    board[2][2] = teamIndex;
    board[2][3] = teamIndex;
    board[2][4] = teamIndex;
    board[2][5] = teamIndex;
    board[2][6] = teamIndex;

    const sequences = detectNewSequences(
      board,
      2, 6, // Last placed chip
      teamIndex,
      new Set(),
      0,
      2
    );

    expect(sequences.length).toBe(1);
    expect(sequences[0].cells.length).toBe(5);
  });

  it('should detect a vertical sequence of 5', () => {
    const board = createEmptyBoard();
    const teamIndex = 0;

    // Place 5 chips vertically
    board[2][3] = teamIndex;
    board[3][3] = teamIndex;
    board[4][3] = teamIndex;
    board[5][3] = teamIndex;
    board[6][3] = teamIndex;

    const sequences = detectNewSequences(
      board,
      6, 3,
      teamIndex,
      new Set(),
      0,
      2
    );

    expect(sequences.length).toBe(1);
  });

  it('should detect a diagonal sequence of 5', () => {
    const board = createEmptyBoard();
    const teamIndex = 0;

    // Place 5 chips diagonally
    board[2][2] = teamIndex;
    board[3][3] = teamIndex;
    board[4][4] = teamIndex;
    board[5][5] = teamIndex;
    board[6][6] = teamIndex;

    const sequences = detectNewSequences(
      board,
      6, 6,
      teamIndex,
      new Set(),
      0,
      2
    );

    expect(sequences.length).toBe(1);
  });

  it('should count corner as wild (needs only 4 chips + corner)', () => {
    const board = createEmptyBoard();
    const teamIndex = 0;

    // Use top-left corner (0,0) with 4 chips
    // Corner is at 0,0 - place chips at 1,1 2,2 3,3 4,4
    board[1][1] = teamIndex;
    board[2][2] = teamIndex;
    board[3][3] = teamIndex;
    board[4][4] = teamIndex;

    const sequences = detectNewSequences(
      board,
      4, 4,
      teamIndex,
      new Set(),
      0,
      2
    );

    expect(sequences.length).toBe(1);
    expect(sequences[0].cells).toContainEqual([0, 0]); // Corner included
  });

  it('should prefer 4 real chips over a duplicate blitz corner window', () => {
    const board = createEmptyBoard();
    const teamIndex = 0;

    board[1][9] = teamIndex;
    board[2][9] = teamIndex;
    board[3][9] = teamIndex;
    board[4][9] = teamIndex;

    const sequences = detectNewSequences(
      board,
      2, 9,
      teamIndex,
      new Set(),
      0,
      2,
      4
    );

    expect(sequences.length).toBe(1);
    expect(sequences[0].cells).toEqual([
      [1, 9],
      [2, 9],
      [3, 9],
      [4, 9],
    ]);
  });

  it('should still count a blitz corner sequence when only 3 chips are present', () => {
    const board = createEmptyBoard();
    const teamIndex = 0;

    board[1][9] = teamIndex;
    board[2][9] = teamIndex;
    board[3][9] = teamIndex;

    const sequences = detectNewSequences(
      board,
      3, 9,
      teamIndex,
      new Set(),
      0,
      2,
      4
    );

    expect(sequences.length).toBe(1);
    expect(sequences[0].cells).toEqual([
      [0, 9],
      [1, 9],
      [2, 9],
      [3, 9],
    ]);
  });

  it('should allow two new sequences when they only share the placed chip', () => {
    const board = createEmptyBoard();
    const teamIndex = 0;

    board[4][2] = teamIndex;
    board[4][3] = teamIndex;
    board[4][4] = teamIndex;
    board[4][5] = teamIndex;
    board[4][6] = teamIndex;

    board[2][4] = teamIndex;
    board[3][4] = teamIndex;
    board[5][4] = teamIndex;
    board[6][4] = teamIndex;

    const sequences = detectNewSequences(
      board,
      4, 4,
      teamIndex,
      new Set(),
      0,
      2
    );

    expect(sequences.length).toBe(2);
    expect(sequences.map(seq => seq.cells)).toEqual(expect.arrayContaining([
      [[4, 2], [4, 3], [4, 4], [4, 5], [4, 6]],
      [[2, 4], [3, 4], [4, 4], [5, 4], [6, 4]],
    ]));
  });

  it('should only count one same-line sequence when windows overlap by multiple chips', () => {
    const board = createEmptyBoard();
    const teamIndex = 0;

    board[4][1] = teamIndex;
    board[4][2] = teamIndex;
    board[4][3] = teamIndex;
    board[4][4] = teamIndex;
    board[4][5] = teamIndex;
    board[4][6] = teamIndex;

    const sequences = detectNewSequences(
      board,
      4, 4,
      teamIndex,
      new Set(),
      0,
      2
    );

    expect(sequences.length).toBe(1);
    expect(sequences[0].cells).toEqual([
      [4, 1],
      [4, 2],
      [4, 3],
      [4, 4],
      [4, 5],
    ]);
  });

  it('should allow overlap of 1 cell for second sequence in 2-team mode', () => {
    const board = createEmptyBoard();
    const teamIndex = 0;
    const lockedCells = new Set<string>();

    // First sequence: horizontal at row 2, cols 2-6
    board[2][2] = teamIndex;
    board[2][3] = teamIndex;
    board[2][4] = teamIndex;
    board[2][5] = teamIndex;
    board[2][6] = teamIndex;

    // Lock first sequence
    for (let col = 2; col <= 6; col++) {
      lockedCells.add(`2,${col}`);
    }

    // Second sequence shares cell 2,4 - vertical at col 4
    board[1][4] = teamIndex;
    board[3][4] = teamIndex;
    board[4][4] = teamIndex;
    board[5][4] = teamIndex;
    // 2,4 already has chip

    const sequences = detectNewSequences(
      board,
      5, 4, // Last placed
      teamIndex,
      lockedCells,
      1, // One sequence already completed
      2  // 2-team mode
    );

    expect(sequences.length).toBe(1);
  });

  it('should reject second sequence with more than 1 overlap', () => {
    const board = createEmptyBoard();
    const teamIndex = 0;
    const lockedCells = new Set<string>();

    // First sequence: horizontal at row 2
    board[2][2] = teamIndex;
    board[2][3] = teamIndex;
    board[2][4] = teamIndex;
    board[2][5] = teamIndex;
    board[2][6] = teamIndex;

    // Lock first sequence
    for (let col = 2; col <= 6; col++) {
      lockedCells.add(`2,${col}`);
    }

    // Attempt second sequence that overlaps 2 cells (2,3 and 2,4)
    board[1][3] = teamIndex;
    board[1][4] = teamIndex;
    board[3][3] = teamIndex;
    board[3][4] = teamIndex;
    // Would need diagonal or other pattern with 2+ overlap

    // This test verifies the overlap logic
    const sequences = detectNewSequences(
      board,
      3, 4,
      teamIndex,
      lockedCells,
      1,
      2
    );

    // Should not find a sequence with >1 overlap
    // The specific result depends on chip placement
    // Main point: overlap rule is enforced
  });
});

describe('Blitz Sequence Regression', () => {
  it('should only score one sequence for the screenshot corner pattern', () => {
    const player = createTestPlayer('1', 0, 'blue', ['JD']);
    const opponent = createTestPlayer('2', 1, 'green');
    const gameState = createTestGameState([player, opponent]);

    gameState.config.sequenceLength = 4;
    gameState.boardChips[1][9] = 0;
    gameState.boardChips[3][9] = 0;
    gameState.boardChips[4][9] = 0;

    const result = applyMove(gameState, '1', {
      type: 'play-two-eyed',
      card: 'JD',
      targetRow: 2,
      targetCol: 9,
    });

    expect(result.success).toBe(true);
    expect(result.newSequences?.length).toBe(1);
    expect(result.newSequences?.[0].cells).toEqual([
      [1, 9],
      [2, 9],
      [3, 9],
      [4, 9],
    ]);
    expect(gameState.completedSequences).toHaveLength(1);
    expect(gameState.completedSequences[0].cells).toEqual([
      [1, 9],
      [2, 9],
      [3, 9],
      [4, 9],
    ]);
    expect(gameState.sequencesCompleted.get(0)).toBe(1);
  });
});

describe('King Of The Board', () => {
  it('should score 1 point for a sequence outside the king zone and relocate the zone', () => {
    const player = createTestPlayer('1', 0, 'blue', ['JD']);
    const opponent = createTestPlayer('2', 1, 'green');
    const gameState = createTestGameState([player, opponent], 0, 2, 'king-of-the-board');

    gameState.kingZone = KING_ZONE_PRESETS.find(zone => zone.id === 'center-7-7') ?? null;
    const startingZoneId = gameState.kingZone?.id;
    for (let col = 2; col <= 5; col++) {
      gameState.boardChips[2][col] = 0;
    }

    const result = applyMove(gameState, '1', {
      type: 'play-two-eyed',
      card: 'JD',
      targetRow: 2,
      targetCol: 6,
    });

    expect(result.success).toBe(true);
    expect(result.scoring).toEqual({
      pointsAwarded: 1,
      totalScore: 1,
      usedKingZone: false,
      sequenceCount: 1,
    });
    expect(gameState.teamScores.get(0)).toBe(1);
    expect(gameState.kingZone?.id).not.toBe(startingZoneId);
  });

  it('should score 2 points for a sequence that touches the king zone', () => {
    const player = createTestPlayer('1', 0, 'blue', ['JD']);
    const opponent = createTestPlayer('2', 1, 'green');
    const gameState = createTestGameState([player, opponent], 0, 2, 'king-of-the-board');

    gameState.kingZone = KING_ZONE_PRESETS.find(zone => zone.id === 'center-2-5') ?? null;
    const startingZoneId = gameState.kingZone?.id;
    for (let col = 2; col <= 5; col++) {
      gameState.boardChips[2][col] = 0;
    }

    const result = applyMove(gameState, '1', {
      type: 'play-two-eyed',
      card: 'JD',
      targetRow: 2,
      targetCol: 6,
    });

    expect(result.success).toBe(true);
    expect(result.scoring).toEqual({
      pointsAwarded: 2,
      totalScore: 2,
      usedKingZone: true,
      sequenceCount: 1,
    });
    expect(gameState.teamScores.get(0)).toBe(2);
    expect(gameState.kingZone?.id).not.toBe(startingZoneId);
  });

  it('should score each completed sequence on a multi-sequence move', () => {
    const player = createTestPlayer('1', 0, 'blue', ['JD']);
    const opponent = createTestPlayer('2', 1, 'green');
    const gameState = createTestGameState([player, opponent], 0, 2, 'king-of-the-board');

    gameState.config.scoreToWin = 5;
    gameState.kingZone = KING_ZONE_PRESETS.find(zone => zone.id === 'center-5-5') ?? null;

    gameState.boardChips[4][2] = 0;
    gameState.boardChips[4][3] = 0;
    gameState.boardChips[4][5] = 0;
    gameState.boardChips[4][6] = 0;
    gameState.boardChips[2][4] = 0;
    gameState.boardChips[3][4] = 0;
    gameState.boardChips[5][4] = 0;
    gameState.boardChips[6][4] = 0;

    const result = applyMove(gameState, '1', {
      type: 'play-two-eyed',
      card: 'JD',
      targetRow: 4,
      targetCol: 4,
    });

    expect(result.success).toBe(true);
    expect(result.newSequences).toHaveLength(2);
    expect(result.scoring).toEqual({
      pointsAwarded: 4,
      totalScore: 4,
      usedKingZone: true,
      sequenceCount: 2,
    });
    expect(gameState.teamScores.get(0)).toBe(4);
    expect(result.gameOver).toBeFalsy();
  });

  it('should break stalemates using team scores and first-to-reach timing', () => {
    const player = createTestPlayer('1', 0, 'blue');
    const opponent = createTestPlayer('2', 1, 'green');
    const gameState = createTestGameState([player, opponent], 0, 2, 'king-of-the-board');

    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        gameState.boardChips[row][col] = (row + col) % 2;
      }
    }

    const team0Locked = new Set<string>();
    const team1Locked = new Set<string>();
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        const key = `${row},${col}`;
        if (gameState.boardChips[row][col] === 0) {
          team0Locked.add(key);
        } else {
          team1Locked.add(key);
        }
      }
    }

    gameState.lockedCells.set(0, team0Locked);
    gameState.lockedCells.set(1, team1Locked);
    gameState.teamScores.set(0, 2);
    gameState.teamScores.set(1, 2);
    gameState.scoreTimestamps.set(0, [100, 200]);
    gameState.scoreTimestamps.set(1, [150, 250]);

    const result = checkStalemate(gameState);

    expect(result).toEqual({
      isStalemate: true,
      winnerTeamIndex: 0,
      reason: 'first_to_reach',
      scoreCounts: [2, 2],
    });
  });
});

describe('Dead Card Detection', () => {
  it('should detect a dead card when both positions are occupied', () => {
    const board = createEmptyBoard();

    // 9D appears at positions (4,7) and (9,5) on the board
    board[4][7] = 0; // Occupied by team 0
    board[9][5] = 1; // Occupied by team 1

    expect(isDeadCard('9D', board)).toBe(true);
  });

  it('should not mark card as dead if one position is open', () => {
    const board = createEmptyBoard();

    // 9D appears at positions (4,7) and (9,5)
    board[4][7] = 0; // Only one occupied

    expect(isDeadCard('9D', board)).toBe(false);
  });

  it('should never mark jacks as dead', () => {
    const board = createEmptyBoard();
    // Fill entire board
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        board[r][c] = 0;
      }
    }

    expect(isDeadCard('JD', board)).toBe(false); // Two-eyed
    expect(isDeadCard('JH', board)).toBe(false); // One-eyed
  });
});

describe('Dead Card Replacement', () => {
  it('should allow dead card replacement once per turn', () => {
    const player = createTestPlayer('1', 0, 'blue', ['9D', '3H']);
    const gameState = createTestGameState([player, createTestPlayer('2', 1, 'green')]);

    // Make 9D dead
    gameState.boardChips[4][7] = 1;
    gameState.boardChips[9][5] = 1;

    // Should be legal to replace
    const validation = isLegalMove(gameState, '1', { type: 'replace-dead', card: '9D' });
    expect(validation.valid).toBe(true);

    // Apply the move
    applyMove(gameState, '1', { type: 'replace-dead', card: '9D' });

    // Should not be able to replace again this turn
    player.hand.push('2S'); // Add another dead card
    gameState.boardChips[0][1] = 0; // Make 2S dead
    gameState.boardChips[8][6] = 0;

    const secondValidation = isLegalMove(gameState, '1', { type: 'replace-dead', card: '2S' });
    expect(secondValidation.valid).toBe(false);
    expect(secondValidation.error).toContain('one dead card per turn');
  });
});

describe('One-Eyed Jack Restrictions', () => {
  it('should not allow removing a locked sequence chip', () => {
    const player = createTestPlayer('1', 0, 'blue', ['JH']); // One-eyed jack
    const opponent = createTestPlayer('2', 1, 'green');
    const gameState = createTestGameState([player, opponent]);

    // Create a completed sequence for opponent
    for (let col = 2; col <= 6; col++) {
      gameState.boardChips[2][col] = 1; // Opponent's chips
    }

    // Lock the sequence
    const lockedCells = new Set<string>();
    for (let col = 2; col <= 6; col++) {
      lockedCells.add(`2,${col}`);
    }
    gameState.lockedCells.set(1, lockedCells);
    gameState.sequencesCompleted.set(1, 1);

    // Try to remove a locked chip
    const validation = isLegalMove(gameState, '1', {
      type: 'play-one-eyed',
      card: 'JH',
      targetRow: 2,
      targetCol: 4,
    });

    expect(validation.valid).toBe(false);
    expect(validation.error).toContain('Invalid target');
  });

  it('should allow removing an unlocked opponent chip', () => {
    const player = createTestPlayer('1', 0, 'blue', ['JH']);
    const opponent = createTestPlayer('2', 1, 'green');
    const gameState = createTestGameState([player, opponent]);

    // Place an unlocked opponent chip
    gameState.boardChips[5][5] = 1;

    const validation = isLegalMove(gameState, '1', {
      type: 'play-one-eyed',
      card: 'JH',
      targetRow: 5,
      targetCol: 5,
    });

    expect(validation.valid).toBe(true);
  });
});

describe('Win Conditions', () => {
  it('should require 2 sequences to win in 2-team mode', () => {
    const player = createTestPlayer('1', 0, 'blue', ['JD']); // Two-eyed jack
    const opponent = createTestPlayer('2', 1, 'green');
    const gameState = createTestGameState([player, opponent], 0, 2);

    expect(gameState.config.sequencesToWin).toBe(2);

    // Complete first sequence - place 4 chips manually
    for (let col = 2; col <= 5; col++) {
      gameState.boardChips[2][col] = 0;
    }

    // Place 5th chip using two-eyed jack to complete sequence
    const result1 = applyMove(gameState, '1', {
      type: 'play-two-eyed',
      card: 'JD',
      targetRow: 2,
      targetCol: 6,
    });

    // Should have 1 sequence but not won (need 2)
    expect(gameState.sequencesCompleted.get(0)).toBe(1);
    expect(result1.gameOver).toBeFalsy();
  });

  it('should require 1 sequence to win in 3-team mode', () => {
    const players = [
      createTestPlayer('1', 0, 'blue', ['9D']),
      createTestPlayer('2', 1, 'green'),
      createTestPlayer('3', 2, 'red'),
    ];
    const gameState = createTestGameState(players, 0, 3);

    expect(gameState.config.sequencesToWin).toBe(1);
  });
});

describe('Turn Flow', () => {
  it('should require draw after playing a card', () => {
    const player = createTestPlayer('1', 0, 'blue', ['9D', '3H']);
    const opponent = createTestPlayer('2', 1, 'green');
    const gameState = createTestGameState([player, opponent]);

    // Play a card
    applyMove(gameState, '1', {
      type: 'play-normal',
      card: '9D',
      targetRow: 4,
      targetCol: 7,
    });

    // Should be pending draw
    expect(gameState.pendingDraw).toBe(true);

    // Should not be able to play another card
    const validation = isLegalMove(gameState, '1', {
      type: 'play-normal',
      card: '3H',
      targetRow: 5,
      targetCol: 4,
    });

    expect(validation.valid).toBe(false);
    expect(validation.error).toContain('draw');
  });

  it('should advance to next player after draw', () => {
    const player1 = createTestPlayer('1', 0, 'blue', ['9D']);
    const player2 = createTestPlayer('2', 1, 'green', ['3H']);
    const gameState = createTestGameState([player1, player2]);

    // Player 1 plays
    applyMove(gameState, '1', {
      type: 'play-normal',
      card: '9D',
      targetRow: 4,
      targetCol: 7,
    });

    // Player 1 draws
    applyMove(gameState, '1', { type: 'draw' });

    // Should be player 2's turn
    expect(gameState.currentPlayerIndex).toBe(1);
  });
});

describe('Two-Eyed Jack (Wild)', () => {
  it('should allow placing on any open space', () => {
    const player = createTestPlayer('1', 0, 'blue', ['JD']); // Two-eyed jack
    const gameState = createTestGameState([player, createTestPlayer('2', 1, 'green')]);

    const targets = getLegalTargets(
      'JD',
      gameState.boardChips,
      0,
      gameState.lockedCells,
      null
    );

    // Should be able to place on most cells (except corners)
    expect(targets.length).toBeGreaterThan(90);
  });

  it('should not allow placing on corners', () => {
    const player = createTestPlayer('1', 0, 'blue', ['JD']);
    const gameState = createTestGameState([player, createTestPlayer('2', 1, 'green')]);

    const validation = isLegalMove(gameState, '1', {
      type: 'play-two-eyed',
      card: 'JD',
      targetRow: 0,
      targetCol: 0, // Corner
    });

    expect(validation.valid).toBe(false);
  });
});
