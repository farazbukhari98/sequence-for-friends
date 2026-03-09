import { describe, it, expect, vi } from 'vitest';
import {
  GameState,
  BoardChips,
  Player,
  TeamColor,
  CardCode,
  GameVariant,
  TEAM_COLORS_2,
} from '../shared/types';
import { createBotPlayer, generateBotName, decideBotAction, getBotDelay, BOT_NAMES } from '../worker/src/bot';
import { createDeck } from '../worker/src/rules/deck';
import { isDeadCard } from '../worker/src/rules/engine';
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
  gameVariant: GameVariant = 'classic'
): GameState {
  const teamScores = new Map<number, number>([[0, 0], [1, 0]]);
  const sequencesCompleted = new Map<number, number>([[0, 0], [1, 0]]);

  return {
    phase: 'playing',
    config: {
      playerCount: players.length,
      teamCount: 2,
      teamColors: TEAM_COLORS_2,
      gameVariant,
      sequencesToWin: 2,
      scoreToWin: gameVariant === 'king-of-the-board' ? 3 : 2,
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

describe('Bot Player Creation', () => {
  it('should create a bot player with correct fields', () => {
    const bot = createBotPlayer('Chip', 'easy');
    expect(bot.isBot).toBe(true);
    expect(bot.botDifficulty).toBe('easy');
    expect(bot.ready).toBe(true);
    expect(bot.connected).toBe(true);
    expect(bot.name).toBe('Chip');
    expect(bot.id).toMatch(/^bot-/);
  });

  it('should create bots with unique IDs', () => {
    const bot1 = createBotPlayer('A', 'easy');
    const bot2 = createBotPlayer('B', 'hard');
    expect(bot1.id).not.toBe(bot2.id);
  });
});

describe('Bot Name Generation', () => {
  it('should generate a name not in existing names', () => {
    const name = generateBotName(['Chip', 'Ace']);
    expect(name).not.toBe('Chip');
    expect(name).not.toBe('Ace');
    expect(name.length).toBeGreaterThan(0);
  });

  it('should handle case-insensitive name matching', () => {
    const name = generateBotName(['chip', 'ACE']);
    expect(name.toLowerCase()).not.toBe('chip');
    expect(name.toLowerCase()).not.toBe('ace');
  });

  it('should fall back when all names taken', () => {
    const name = generateBotName([...BOT_NAMES]);
    expect(name).toMatch(/^Bot \d+$/);
  });
});

describe('Bot Delay', () => {
  it('should return delays in expected ranges', () => {
    for (let i = 0; i < 10; i++) {
      const easyDelay = getBotDelay('easy');
      expect(easyDelay).toBeGreaterThanOrEqual(1500);
      expect(easyDelay).toBeLessThanOrEqual(3000);

      const medDelay = getBotDelay('medium');
      expect(medDelay).toBeGreaterThanOrEqual(800);
      expect(medDelay).toBeLessThanOrEqual(1800);

      const hardDelay = getBotDelay('hard');
      expect(hardDelay).toBeGreaterThanOrEqual(500);
      expect(hardDelay).toBeLessThanOrEqual(1200);
    }
  });
});

describe('Bot Move Decision - Easy', () => {
  it('should return a valid move for easy difficulty', () => {
    const bot = createTestPlayer('bot-1', 0, 'blue', ['9D', '3H', '5S']);
    bot.isBot = true;
    bot.botDifficulty = 'easy';
    const human = createTestPlayer('human', 1, 'green');
    const gs = createTestGameState([bot, human]);

    const action = decideBotAction(gs, bot, 'easy');
    expect(action.type).not.toBe('draw'); // Should play a card, not draw
    expect(['play-normal', 'play-two-eyed', 'play-one-eyed', 'replace-dead']).toContain(action.type);
  });

  it('should handle dead card replacement', () => {
    const bot = createTestPlayer('bot-1', 0, 'blue', ['9D']);
    bot.isBot = true;
    const human = createTestPlayer('human', 1, 'green');
    const gs = createTestGameState([bot, human]);

    // Make 9D dead: appears at (4,7) and (9,5)
    gs.boardChips[4][7] = 1;
    gs.boardChips[9][5] = 1;

    const action = decideBotAction(gs, bot, 'easy');
    expect(action.type).toBe('replace-dead');
    if (action.type === 'replace-dead') {
      expect(action.card).toBe('9D');
    }
  });

  it('should return draw when pendingDraw is true', () => {
    const bot = createTestPlayer('bot-1', 0, 'blue', ['3H']);
    bot.isBot = true;
    const human = createTestPlayer('human', 1, 'green');
    const gs = createTestGameState([bot, human]);
    gs.pendingDraw = true;

    const action = decideBotAction(gs, bot, 'easy');
    expect(action.type).toBe('draw');
  });
});

describe('Bot Move Decision - Medium', () => {
  it('should return a valid move', () => {
    const bot = createTestPlayer('bot-1', 0, 'blue', ['9D', '3H', '5S', 'KH', '2D']);
    bot.isBot = true;
    const human = createTestPlayer('human', 1, 'green');
    const gs = createTestGameState([bot, human]);

    const action = decideBotAction(gs, bot, 'medium');
    expect(['play-normal', 'play-two-eyed', 'play-one-eyed', 'replace-dead']).toContain(action.type);
  });

  it('should prefer completing a sequence', () => {
    // Set up a board where bot is 1 chip away from a sequence
    const bot = createTestPlayer('bot-1', 0, 'blue', ['7D', '3H']);
    bot.isBot = true;
    const human = createTestPlayer('human', 1, 'green');
    const gs = createTestGameState([bot, human]);

    // Place 4 chips in a row for team 0 at row 2, cols 3-6 (4D,5D,6D,7D on the board)
    // BOARD_LAYOUT row 2: 7C, AS, 2D, 3D, 4D, 5D, 6D, 7D, 9H, QS
    gs.boardChips[2][2] = 0; // 2D
    gs.boardChips[2][3] = 0; // 3D
    gs.boardChips[2][4] = 0; // 4D
    gs.boardChips[2][5] = 0; // 5D

    // 7D is at position (2,7) — playing it completes row 2 cols 2-6? No, let's check.
    // Actually 6D is at (2,6). Let's add that as a chip too and use a card for position (2,6)
    // Let's set up: we need 5 in a row. Cols 2-6 of row 2 = 2D,3D,4D,5D,6D
    // 4 placed at cols 2-5. Bot has card 6D. But 6D may not be in hand. Let's use 6D.
    // Actually we gave bot 7D. Let me look at board layout row 2:
    // ['7C', 'AS', '2D', '3D', '4D', '5D', '6D', '7D', '9H', 'QS']
    // Cols: 0=7C, 1=AS, 2=2D, 3=3D, 4=4D, 5=5D, 6=6D, 7=7D, 8=9H, 9=QS
    // So 7D at (2,7). With chips at (2,2),(2,3),(2,4),(2,5), placing 6D at (2,6) gives 5-in-a-row.
    // But we gave bot 7D not 6D. Let's give bot 6D instead.
    bot.hand = ['6D', '3H'];

    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    const action = decideBotAction(gs, bot, 'medium');
    randomSpy.mockRestore();

    expect(action.type).toBe('play-normal');
    if (action.type === 'play-normal') {
      expect(action.card).toBe('6D');
      expect(action.targetRow).toBe(2);
      expect(action.targetCol).toBe(6);
    }
  });
});

describe('Bot Move Decision - Hard', () => {
  it('should return a valid move', () => {
    const bot = createTestPlayer('bot-1', 0, 'blue', ['9D', '3H', 'JH', 'KH', '2D']);
    bot.isBot = true;
    const human = createTestPlayer('human', 1, 'green');
    const gs = createTestGameState([bot, human]);

    const action = decideBotAction(gs, bot, 'hard');
    expect(['play-normal', 'play-two-eyed', 'play-one-eyed', 'replace-dead']).toContain(action.type);
  });

  it('should block opponent threats', () => {
    // Opponent has 4 in a row, bot has a one-eyed jack
    const bot = createTestPlayer('bot-1', 0, 'blue', ['JH']); // one-eyed jack
    bot.isBot = true;
    const human = createTestPlayer('human', 1, 'green');
    const gs = createTestGameState([bot, human]);

    // Opponent has 4 chips in row 4
    gs.boardChips[4][3] = 1;
    gs.boardChips[4][4] = 1;
    gs.boardChips[4][5] = 1;
    gs.boardChips[4][6] = 1;

    // Hard bot should use one-eyed jack to remove one of these
    const action = decideBotAction(gs, bot, 'hard');
    expect(action.type).toBe('play-one-eyed');
    if (action.type === 'play-one-eyed') {
      expect(action.targetRow).toBe(4);
      expect([3, 4, 5, 6]).toContain(action.targetCol);
    }
  });
});

describe('Bot Move Decision - Impossible', () => {
  it('should not overvalue duplicate blitz corner windows when blocking', () => {
    const bot = createTestPlayer('bot-1', 0, 'blue', ['JD']);
    bot.isBot = true;
    bot.botDifficulty = 'impossible';
    const human = createTestPlayer('human', 1, 'green');
    const gs = createTestGameState([bot, human]);

    gs.config.sequenceLength = 4;

    // Threat A: screenshot-style corner overlap on the top-right column.
    gs.boardChips[1][9] = 1;
    gs.boardChips[3][9] = 1;
    gs.boardChips[4][9] = 1;

    // Threat B: a single blitz completion in the center.
    gs.boardChips[4][2] = 1;
    gs.boardChips[4][3] = 1;
    gs.boardChips[4][5] = 1;

    const action = decideBotAction(gs, bot, 'impossible');
    expect(action.type).toBe('play-two-eyed');
    if (action.type === 'play-two-eyed') {
      expect(action.targetRow).toBe(4);
      expect(action.targetCol).toBe(4);
    }
  });
});

describe('Bot Jack Usage', () => {
  it('should use two-eyed jack correctly', () => {
    const bot = createTestPlayer('bot-1', 0, 'blue', ['JD']); // Two-eyed jack (wild)
    bot.isBot = true;
    const human = createTestPlayer('human', 1, 'green');
    const gs = createTestGameState([bot, human]);

    const action = decideBotAction(gs, bot, 'easy');
    expect(action.type).toBe('play-two-eyed');
  });

  it('should use one-eyed jack to remove opponent chip', () => {
    const bot = createTestPlayer('bot-1', 0, 'blue', ['JS']); // One-eyed jack (remove)
    bot.isBot = true;
    const human = createTestPlayer('human', 1, 'green');
    const gs = createTestGameState([bot, human]);

    // Place an opponent chip
    gs.boardChips[5][5] = 1;

    const action = decideBotAction(gs, bot, 'easy');
    expect(action.type).toBe('play-one-eyed');
  });
});
