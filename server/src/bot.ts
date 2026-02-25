import { v4 as uuidv4 } from 'uuid';
import {
  Player,
  GameState,
  GameAction,
  CardCode,
  BotDifficulty,
  isJack,
  getJackType,
  findCardPositions,
  isCorner,
  cellKey,
} from '../../shared/types.js';

export const BOT_NAMES = [
  'Chip', 'Ace', 'Deuce', 'Blitz', 'Nova', 'Sage', 'Jinx', 'Dash',
  'Echo', 'Flair', 'Pixel', 'Bolt', 'Spark', 'Coda', 'Rune', 'Flux',
];
import { isDeadCard, getLegalTargets } from './rules/engine.js';
import { getSequencesThroughCell } from './rules/sequences.js';

/**
 * Create a bot player
 */
export function createBotPlayer(name: string, difficulty: BotDifficulty): Player {
  return {
    id: `bot-${uuidv4()}`,
    name,
    token: `bot-token-${uuidv4()}`,
    seatIndex: 0,
    teamIndex: 0,
    teamColor: 'blue',
    connected: true,
    ready: true,
    hand: [],
    discardPile: [],
    isBot: true,
    botDifficulty: difficulty,
  };
}

/**
 * Generate a bot name that doesn't conflict with existing player names
 */
export function generateBotName(existingNames: string[]): string {
  const lowerNames = existingNames.map(n => n.toLowerCase());
  for (const name of BOT_NAMES) {
    if (!lowerNames.includes(name.toLowerCase())) {
      return name;
    }
  }
  // Fallback: append a number
  return `Bot ${existingNames.length + 1}`;
}

/**
 * Get randomized delay for bot moves based on difficulty
 */
export function getBotDelay(difficulty: BotDifficulty): number {
  switch (difficulty) {
    case 'easy': return 1500 + Math.random() * 1500; // 1500-3000ms
    case 'medium': return 800 + Math.random() * 1000; // 800-1800ms
    case 'hard': return 500 + Math.random() * 700; // 500-1200ms
  }
}

/**
 * Decide what action a bot should take
 */
export function decideBotAction(
  gameState: GameState,
  botPlayer: Player,
  difficulty: BotDifficulty
): GameAction {
  // First, check for dead cards
  const deadCards = botPlayer.hand.filter(card => isDeadCard(card, gameState.boardChips));
  if (deadCards.length > 0 && !gameState.deadCardReplacedThisTurn) {
    return { type: 'replace-dead', card: deadCards[0] };
  }

  // If pending draw, draw
  if (gameState.pendingDraw) {
    return { type: 'draw' };
  }

  // Get all valid moves
  const validMoves = getAllValidMoves(gameState, botPlayer);

  if (validMoves.length === 0) {
    // No valid moves — shouldn't happen if we handled dead cards, but draw as fallback
    return { type: 'draw' };
  }

  switch (difficulty) {
    case 'easy':
      return pickRandomMove(validMoves);
    case 'medium':
      return pickMediumMove(validMoves, gameState, botPlayer);
    case 'hard':
      return pickHardMove(validMoves, gameState, botPlayer);
  }
}

interface ScoredMove {
  action: GameAction;
  score: number;
}

/**
 * Get all valid play moves for the bot
 */
function getAllValidMoves(gameState: GameState, player: Player): GameAction[] {
  const moves: GameAction[] = [];

  for (const card of player.hand) {
    // Skip dead cards
    if (isDeadCard(card, gameState.boardChips)) continue;

    const jackType = getJackType(card);
    const targets = getLegalTargets(
      card,
      gameState.boardChips,
      player.teamIndex,
      gameState.lockedCells,
      gameState.lastRemovedCell
    );

    for (const [row, col] of targets) {
      if (jackType === 'two-eyed') {
        moves.push({ type: 'play-two-eyed', card, targetRow: row, targetCol: col });
      } else if (jackType === 'one-eyed') {
        moves.push({ type: 'play-one-eyed', card, targetRow: row, targetCol: col });
      } else {
        moves.push({ type: 'play-normal', card, targetRow: row, targetCol: col });
      }
    }
  }

  return moves;
}

/**
 * Easy: pick a random valid move
 */
function pickRandomMove(moves: GameAction[]): GameAction {
  return moves[Math.floor(Math.random() * moves.length)];
}

/**
 * Medium: heuristic scoring
 */
function pickMediumMove(moves: GameAction[], gameState: GameState, botPlayer: Player): GameAction {
  const scored = moves.map(action => ({
    action,
    score: scoreMoveBasic(action, gameState, botPlayer),
  }));

  scored.sort((a, b) => b.score - a.score);

  // Pick from top 3 with some randomness
  const topN = Math.min(3, scored.length);
  const idx = Math.floor(Math.random() * topN);
  return scored[idx].action;
}

/**
 * Hard: thorough scoring with look-ahead
 */
function pickHardMove(moves: GameAction[], gameState: GameState, botPlayer: Player): GameAction {
  const scored = moves.map(action => ({
    action,
    score: scoreMoveAdvanced(action, gameState, botPlayer),
  }));

  scored.sort((a, b) => b.score - a.score);

  // Pick the best move (small chance of 2nd best for variety)
  if (scored.length > 1 && Math.random() < 0.1) {
    return scored[1].action;
  }
  return scored[0].action;
}

/**
 * Basic move scoring for Medium difficulty
 */
function scoreMoveBasic(action: GameAction, gameState: GameState, botPlayer: Player): number {
  if (action.type === 'draw' || action.type === 'replace-dead') return 0;

  let score = 0;
  const { targetRow, targetCol } = action;
  const teamIndex = botPlayer.teamIndex;
  const { boardChips, lockedCells, sequencesCompleted, config } = gameState;

  // One-eyed jack: score based on blocking
  if (action.type === 'play-one-eyed') {
    score += scoreRemoval(targetRow, targetCol, gameState, botPlayer);
    return score;
  }

  // Check if this move completes a sequence
  const tempBoard = boardChips.map(row => [...row]);
  tempBoard[targetRow][targetCol] = teamIndex;

  const teamLockedCells = lockedCells.get(teamIndex) || new Set<string>();
  const teamSequences = sequencesCompleted.get(teamIndex) || 0;
  const newSeqs = getSequencesThroughCell(tempBoard, targetRow, targetCol, teamIndex, config.sequenceLength);

  // Filter to valid new sequences
  for (const seq of newSeqs) {
    const allLocked = seq.cells.every(([r, c]) =>
      teamLockedCells.has(cellKey(r, c)) || isCorner(r, c)
    );
    if (allLocked) continue;

    // Check overlap rule
    if (teamSequences > 0) {
      let overlap = 0;
      for (const [r, c] of seq.cells) {
        if (!isCorner(r, c) && teamLockedCells.has(cellKey(r, c))) overlap++;
      }
      if (overlap > 1) continue;
    }

    score += 10000; // Completing a sequence is top priority
    break;
  }

  // Count adjacent friendly chips (extending runs)
  score += countAdjacentFriendly(targetRow, targetCol, teamIndex, boardChips) * 100;

  // Center board bonus
  score += centerBonus(targetRow, targetCol);

  // Penalize using two-eyed jacks for non-critical moves
  if (action.type === 'play-two-eyed' && score < 5000) {
    score -= 200;
  }

  return score;
}

/**
 * Advanced move scoring for Hard difficulty
 */
function scoreMoveAdvanced(action: GameAction, gameState: GameState, botPlayer: Player): number {
  let score = scoreMoveBasic(action, gameState, botPlayer);
  if (action.type === 'draw' || action.type === 'replace-dead') return score;

  const { targetRow, targetCol } = action;
  const teamIndex = botPlayer.teamIndex;
  const { boardChips, config } = gameState;

  // Block opponent threats
  score += scoreOpponentBlocking(targetRow, targetCol, gameState, botPlayer);

  // Dual-threat creation: placing here creates multiple near-complete lines
  const tempBoard = boardChips.map(row => [...row]);
  tempBoard[targetRow][targetCol] = teamIndex;
  score += scoreDualThreat(targetRow, targetCol, teamIndex, tempBoard, config.sequenceLength);

  // One-eyed jack optimization for hard mode
  if (action.type === 'play-one-eyed') {
    // Additional scoring for removing chips that are part of opponent near-sequences
    score += 100; // Hard mode values removal higher
  }

  return score;
}

/**
 * Score removing an opponent chip
 */
function scoreRemoval(row: number, col: number, gameState: GameState, botPlayer: Player): number {
  let score = 50; // Base removal value
  const { boardChips, config } = gameState;
  const opponentTeam = boardChips[row][col];
  if (opponentTeam === null) return 0;

  // Check how many adjacent chips the opponent has near this cell
  const adjCount = countAdjacentFriendly(row, col, opponentTeam, boardChips);
  score += adjCount * 150; // More adjacent = more important to remove

  // Check if opponent is close to completing a sequence through this cell
  const opponentSeqs = getSequencesThroughCell(boardChips, row, col, opponentTeam, config.sequenceLength);
  for (const seq of opponentSeqs) {
    const filled = seq.cells.filter(([r, c]) =>
      boardChips[r][c] === opponentTeam || isCorner(r, c)
    ).length;
    if (filled >= config.sequenceLength - 1) {
      score += 500; // Blocking a near-complete sequence
    } else if (filled >= config.sequenceLength - 2) {
      score += 200;
    }
  }

  return score;
}

/**
 * Score blocking opponent by placing on a cell they need
 */
function scoreOpponentBlocking(row: number, col: number, gameState: GameState, botPlayer: Player): number {
  let score = 0;
  const { boardChips, config, players } = gameState;

  // Check all opponent teams
  const opponentTeams = new Set<number>();
  for (const p of players) {
    if (p.teamIndex !== botPlayer.teamIndex) {
      opponentTeams.add(p.teamIndex);
    }
  }

  for (const oppTeam of opponentTeams) {
    // Temporarily check what sequences this cell could contribute to for opponent
    const tempBoard = boardChips.map(r => [...r]);
    tempBoard[row][col] = oppTeam;
    const oppSeqs = getSequencesThroughCell(tempBoard, row, col, oppTeam, config.sequenceLength);

    for (const seq of oppSeqs) {
      const filled = seq.cells.filter(([r, c]) =>
        boardChips[r][c] === oppTeam || isCorner(r, c)
      ).length;
      // If opponent had 3+ of 5 (or 3+ of 4 in blitz), blocking is valuable
      if (filled >= config.sequenceLength - 2) {
        score += 300;
      } else if (filled >= config.sequenceLength - 3) {
        score += 100;
      }
    }
  }

  return score;
}

/**
 * Score dual-threat creation (multiple near-complete lines)
 */
function scoreDualThreat(row: number, col: number, teamIndex: number, boardWithMove: (number | null)[][], sequenceLength: number): number {
  const DIRECTIONS: [number, number][] = [[0, 1], [1, 0], [1, 1], [1, -1]];
  let nearCompleteCount = 0;

  for (const [dRow, dCol] of DIRECTIONS) {
    // Count consecutive in both directions
    let count = 1; // The placed chip

    // Forward
    let r = row + dRow, c = col + dCol;
    while (r >= 0 && r < 10 && c >= 0 && c < 10 && (boardWithMove[r][c] === teamIndex || isCorner(r, c))) {
      count++;
      r += dRow;
      c += dCol;
    }

    // Backward
    r = row - dRow;
    c = col - dCol;
    while (r >= 0 && r < 10 && c >= 0 && c < 10 && (boardWithMove[r][c] === teamIndex || isCorner(r, c))) {
      count++;
      r -= dRow;
      c -= dCol;
    }

    if (count >= sequenceLength - 1) {
      nearCompleteCount++;
    }
  }

  // Multiple near-complete lines = dual threat
  if (nearCompleteCount >= 2) return 400;
  if (nearCompleteCount >= 1) return 50;
  return 0;
}

/**
 * Count adjacent friendly chips around a position
 */
function countAdjacentFriendly(row: number, col: number, teamIndex: number, boardChips: (number | null)[][]): number {
  const DIRECTIONS: [number, number][] = [
    [0, 1], [0, -1], [1, 0], [-1, 0],
    [1, 1], [1, -1], [-1, 1], [-1, -1],
  ];

  let count = 0;
  for (const [dr, dc] of DIRECTIONS) {
    const r = row + dr, c = col + dc;
    if (r >= 0 && r < 10 && c >= 0 && c < 10) {
      if (boardChips[r][c] === teamIndex || isCorner(r, c)) {
        count++;
      }
    }
  }
  return count;
}

/**
 * Bonus for center-board positions
 */
function centerBonus(row: number, col: number): number {
  const centerDist = Math.abs(row - 4.5) + Math.abs(col - 4.5);
  return Math.max(0, Math.round((9 - centerDist) * 5));
}
