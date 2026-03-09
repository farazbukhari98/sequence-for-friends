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
  BOARD_LAYOUT,
  BoardCell,
} from '../../shared/types.js';

export const BOT_NAMES = [
  'Chip', 'Ace', 'Deuce', 'Blitz', 'Nova', 'Sage', 'Jinx', 'Dash',
  'Echo', 'Flair', 'Pixel', 'Bolt', 'Spark', 'Coda', 'Rune', 'Flux',
];
import { isDeadCard, getLegalTargets } from './rules/engine.js';
import { detectNewSequences } from './rules/sequences.js';

/**
 * Create a bot player
 */
export function createBotPlayer(name: string, difficulty: BotDifficulty): Player {
  return {
    id: `bot-${crypto.randomUUID()}`,
    name,
    token: `bot-token-${crypto.randomUUID()}`,
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
  return `Bot ${existingNames.length + 1}`;
}

/**
 * Get randomized delay for bot moves based on difficulty
 */
export function getBotDelay(difficulty: BotDifficulty): number {
  switch (difficulty) {
    case 'easy': return 1500 + Math.random() * 1500;
    case 'medium': return 800 + Math.random() * 1000;
    case 'hard': return 500 + Math.random() * 700;
    case 'impossible': return 300 + Math.random() * 200;
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
  // Check pendingDraw FIRST — must draw before any other action
  if (gameState.pendingDraw) {
    return { type: 'draw' };
  }

  // Replace dead cards if allowed this turn
  const deadCards = botPlayer.hand.filter(card => isDeadCard(card, gameState.boardChips));
  if (deadCards.length > 0 && !gameState.deadCardReplacedThisTurn) {
    return { type: 'replace-dead', card: deadCards[0] };
  }

  const validMoves = getAllValidMoves(gameState, botPlayer);

  if (validMoves.length === 0) {
    // All remaining cards are dead and already replaced once — force skip
    return { type: 'draw' } as GameAction & { _forceSkip?: true };
  }

  switch (difficulty) {
    case 'easy':
      return pickRandomMove(validMoves);
    case 'medium':
      return pickMediumMove(validMoves, gameState, botPlayer);
    case 'hard':
      return pickHardMove(validMoves, gameState, botPlayer);
    case 'impossible':
      return pickImpossibleMove(validMoves, gameState, botPlayer);
  }
}

/**
 * Get all valid play moves for the bot
 */
function getAllValidMoves(gameState: GameState, player: Player): GameAction[] {
  const moves: GameAction[] = [];

  for (const card of player.hand) {
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

function pickRandomMove(moves: GameAction[]): GameAction {
  return moves[Math.floor(Math.random() * moves.length)];
}

function pickMediumMove(moves: GameAction[], gameState: GameState, botPlayer: Player): GameAction {
  const scored = moves.map(action => ({
    action,
    score: scoreMoveBasic(action, gameState, botPlayer),
  }));

  scored.sort((a, b) => b.score - a.score);

  const topN = Math.min(3, scored.length);
  const idx = Math.floor(Math.random() * topN);
  return scored[idx].action;
}

function pickHardMove(moves: GameAction[], gameState: GameState, botPlayer: Player): GameAction {
  const scored = moves.map(action => ({
    action,
    score: scoreMoveAdvanced(action, gameState, botPlayer),
  }));

  scored.sort((a, b) => b.score - a.score);

  if (scored.length > 1 && Math.random() < 0.1) {
    return scored[1].action;
  }
  return scored[0].action;
}

function scoreMoveBasic(action: GameAction, gameState: GameState, botPlayer: Player): number {
  if (action.type === 'draw' || action.type === 'replace-dead') return 0;

  let score = 0;
  const { targetRow, targetCol } = action;
  const teamIndex = botPlayer.teamIndex;
  const { boardChips, lockedCells, sequencesCompleted, config } = gameState;

  if (action.type === 'play-one-eyed') {
    score += scoreRemoval(targetRow, targetCol, gameState, botPlayer);
    return score;
  }

  const tempBoard = boardChips.map(row => [...row]);
  tempBoard[targetRow][targetCol] = teamIndex;

  const teamLockedCells = lockedCells.get(teamIndex) || new Set<string>();
  const teamSequences = sequencesCompleted.get(teamIndex) || 0;
  const newSeqs = detectNewSequences(
    tempBoard,
    targetRow,
    targetCol,
    teamIndex,
    teamLockedCells,
    teamSequences,
    config.sequencesToWin,
    config.sequenceLength
  );

  for (const seq of newSeqs) {
    score += 10000;
    break;
  }

  score += countAdjacentFriendly(targetRow, targetCol, teamIndex, boardChips) * 100;
  score += centerBonus(targetRow, targetCol);

  if (action.type === 'play-two-eyed' && score < 5000) {
    score -= 200;
  }

  return score;
}

function scoreMoveAdvanced(action: GameAction, gameState: GameState, botPlayer: Player): number {
  let score = scoreMoveBasic(action, gameState, botPlayer);
  if (action.type === 'draw' || action.type === 'replace-dead') return score;

  const { targetRow, targetCol } = action;
  const teamIndex = botPlayer.teamIndex;
  const { boardChips, config } = gameState;

  score += scoreOpponentBlocking(targetRow, targetCol, gameState, botPlayer);

  const tempBoard = boardChips.map(row => [...row]);
  tempBoard[targetRow][targetCol] = teamIndex;
  score += scoreDualThreat(targetRow, targetCol, teamIndex, tempBoard, config.sequenceLength);

  if (action.type === 'play-one-eyed') {
    score += 100;
  }

  return score;
}

function scoreRemoval(row: number, col: number, gameState: GameState, botPlayer: Player): number {
  let score = 50;
  const { boardChips, config } = gameState;
  const opponentTeam = boardChips[row][col];
  if (opponentTeam === null) return 0;

  const adjCount = countAdjacentFriendly(row, col, opponentTeam, boardChips);
  score += adjCount * 150;

  const opponentLocked = gameState.lockedCells.get(opponentTeam) || new Set<string>();
  const opponentCompleted = gameState.sequencesCompleted.get(opponentTeam) || 0;
  const opponentSeqs = detectNewSequences(
    boardChips,
    row,
    col,
    opponentTeam,
    opponentLocked,
    opponentCompleted,
    config.sequencesToWin,
    config.sequenceLength
  );
  for (const seq of opponentSeqs) {
    const filled = seq.cells.filter(([r, c]) =>
      boardChips[r][c] === opponentTeam || isCorner(r, c)
    ).length;
    if (filled >= config.sequenceLength - 1) {
      score += 500;
    } else if (filled >= config.sequenceLength - 2) {
      score += 200;
    }
  }

  return score;
}

function scoreOpponentBlocking(row: number, col: number, gameState: GameState, botPlayer: Player): number {
  let score = 0;
  const { boardChips, config, players } = gameState;

  const opponentTeams = new Set<number>();
  for (const p of players) {
    if (p.teamIndex !== botPlayer.teamIndex) {
      opponentTeams.add(p.teamIndex);
    }
  }

  for (const oppTeam of opponentTeams) {
    const tempBoard = boardChips.map(r => [...r]);
    tempBoard[row][col] = oppTeam;
    const oppLocked = gameState.lockedCells.get(oppTeam) || new Set<string>();
    const oppCompleted = gameState.sequencesCompleted.get(oppTeam) || 0;
    const oppSeqs = detectNewSequences(
      tempBoard,
      row,
      col,
      oppTeam,
      oppLocked,
      oppCompleted,
      config.sequencesToWin,
      config.sequenceLength
    );

    for (const seq of oppSeqs) {
      const filled = seq.cells.filter(([r, c]) =>
        boardChips[r][c] === oppTeam || isCorner(r, c)
      ).length;
      if (filled >= config.sequenceLength - 2) {
        score += 300;
      } else if (filled >= config.sequenceLength - 3) {
        score += 100;
      }
    }
  }

  return score;
}

function scoreDualThreat(row: number, col: number, teamIndex: number, boardWithMove: (number | null)[][], sequenceLength: number): number {
  const DIRECTIONS: [number, number][] = [[0, 1], [1, 0], [1, 1], [1, -1]];
  let nearCompleteCount = 0;

  for (const [dRow, dCol] of DIRECTIONS) {
    let count = 1;

    let r = row + dRow, c = col + dCol;
    while (r >= 0 && r < 10 && c >= 0 && c < 10 && (boardWithMove[r][c] === teamIndex || isCorner(r, c))) {
      count++;
      r += dRow;
      c += dCol;
    }

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

  if (nearCompleteCount >= 2) return 400;
  if (nearCompleteCount >= 1) return 50;
  return 0;
}

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

function centerBonus(row: number, col: number): number {
  const centerDist = Math.abs(row - 4.5) + Math.abs(col - 4.5);
  return Math.max(0, Math.round((9 - centerDist) * 5));
}

// ============================================
// IMPOSSIBLE BOT — Viable Path Analysis (VPA)
// ============================================

type Line = [number, number][];

/**
 * Pre-compute all possible sequence lines on the board for a given length.
 * Returns ~192 lines for length 5, ~252 for length 4.
 */
function enumerateAllLines(sequenceLength: number): Line[] {
  const lines: Line[] = [];
  const DIRECTIONS: [number, number][] = [[0, 1], [1, 0], [1, 1], [1, -1]];

  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 10; col++) {
      for (const [dr, dc] of DIRECTIONS) {
        const endRow = row + dr * (sequenceLength - 1);
        const endCol = col + dc * (sequenceLength - 1);
        if (endRow < 0 || endRow >= 10 || endCol < 0 || endCol >= 10) continue;

        const line: Line = [];
        for (let i = 0; i < sequenceLength; i++) {
          line.push([row + dr * i, col + dc * i]);
        }
        lines.push(line);
      }
    }
  }
  return lines;
}

/**
 * Check if a line is viable for a team: no opponent chips, and respects
 * the overlap rule (at most 1 non-corner locked cell shared with existing sequences).
 */
function isLineViableForTeam(
  line: Line,
  teamIndex: number,
  boardChips: (number | null)[][],
  lockedCells: Map<number, Set<string>>,
  sequencesCompleted: Map<number, number>,
): boolean {
  const teamLocked = lockedCells.get(teamIndex) || new Set<string>();
  const teamSeqs = sequencesCompleted.get(teamIndex) || 0;

  let nonCornerLockedOverlap = 0;
  for (const [r, c] of line) {
    if (isCorner(r, c)) continue;
    const chip = boardChips[r][c];
    // Blocked by opponent chip
    if (chip !== null && chip !== teamIndex) return false;
    if (teamSeqs > 0 && teamLocked.has(cellKey(r, c))) {
      nonCornerLockedOverlap++;
    }
  }
  // Overlap rule: at most 1 shared non-corner locked cell
  if (teamSeqs > 0 && nonCornerLockedOverlap > 1) return false;
  return true;
}

/**
 * Count how many cells in a line are filled by the team (including corners).
 */
function countFilled(line: Line, teamIndex: number, boardChips: (number | null)[][]): number {
  let count = 0;
  for (const [r, c] of line) {
    if (isCorner(r, c) || boardChips[r][c] === teamIndex) count++;
  }
  return count;
}

/**
 * Get empty (unfilled) cells in a line for a team.
 */
function getEmptyCells(line: Line, teamIndex: number, boardChips: (number | null)[][]): [number, number][] {
  const empty: [number, number][] = [];
  for (const [r, c] of line) {
    if (!isCorner(r, c) && boardChips[r][c] !== teamIndex) {
      empty.push([r, c]);
    }
  }
  return empty;
}

/**
 * Score hand synergy: how many of the empty cells in a line can be filled by cards in hand.
 */
function scoreHandSynergy(
  emptyCells: [number, number][],
  hand: CardCode[],
  boardChips: (number | null)[][],
): number {
  let synergy = 0;
  const twoEyedInHand = hand.some(c => getJackType(c) === 'two-eyed');

  for (const [r, c] of emptyCells) {
    const cellCard = BOARD_LAYOUT[r][c] as BoardCell;
    if (cellCard === 'W') continue; // corners are already filled
    // Check if any card in hand matches this cell
    const hasMatch = hand.some(card => {
      if (isJack(card)) return false;
      return card === cellCard;
    });
    if (hasMatch || twoEyedInHand) {
      synergy += 80;
    }
  }
  return synergy;
}

/**
 * Score a placement move for the impossible bot.
 */
function scoreMoveImpossible(
  action: GameAction & { targetRow: number; targetCol: number },
  gameState: GameState,
  botPlayer: Player,
  allLines: Line[],
  opponentTeams: number[],
): number {
  const { targetRow, targetCol } = action;
  const teamIndex = botPlayer.teamIndex;
  const { boardChips, lockedCells, sequencesCompleted, config } = gameState;
  const seqLen = config.sequenceLength;

  let score = 0;

  // Simulate the placement
  const tempBoard = boardChips.map(row => [...row]);
  tempBoard[targetRow][targetCol] = teamIndex;

  // --- Priority 1: Sequence completion ---
  const teamLocked = lockedCells.get(teamIndex) || new Set<string>();
  const teamSeqs = sequencesCompleted.get(teamIndex) || 0;
  const newSeqs = detectNewSequences(
    tempBoard,
    targetRow,
    targetCol,
    teamIndex,
    teamLocked,
    teamSeqs,
    config.sequencesToWin,
    config.sequenceLength
  );
  let completesSequence = false;

  for (const seq of newSeqs) {
    if (teamSeqs + 1 >= config.sequencesToWin) {
      score += 500000; // Game-winning
    } else {
      score += 100000; // Non-winning completion
    }
    completesSequence = true;
    break;
  }

  // --- Priority 2: Block opponent ---
  for (const oppTeam of opponentTeams) {
    const oppLocked = lockedCells.get(oppTeam) || new Set<string>();
    const oppSeqs = sequencesCompleted.get(oppTeam) || 0;

    // Check if opponent would complete a sequence through this cell
    const oppTempBoard = boardChips.map(row => [...row]);
    oppTempBoard[targetRow][targetCol] = oppTeam;
    const oppNewSeqs = detectNewSequences(
      oppTempBoard,
      targetRow,
      targetCol,
      oppTeam,
      oppLocked,
      oppSeqs,
      config.sequencesToWin,
      config.sequenceLength
    );

    for (const seq of oppNewSeqs) {
      const filled = seq.cells.filter(([r, c]) =>
        boardChips[r][c] === oppTeam || isCorner(r, c)
      ).length;

      if (filled >= seqLen - 1) {
        // Opponent 1 away — this cell blocks a completion
        if (oppSeqs + 1 >= config.sequencesToWin) {
          score += 130000; // Block game-winning
        } else {
          score += 50000; // Block regular completion
        }
      }
    }

    // Proactive blocking: check opponent lines through this cell
    for (const line of allLines) {
      if (!line.some(([r, c]) => r === targetRow && c === targetCol)) continue;
      if (!isLineViableForTeam(line, oppTeam, boardChips, lockedCells, sequencesCompleted)) continue;

      const oppFilled = countFilled(line, oppTeam, boardChips);
      if (oppFilled >= seqLen - 2 && oppFilled < seqLen - 1) {
        score += 5000; // Proactive block at 3/5
      }
    }
  }

  // --- Priority 3: Fork creation & path advancement ---
  let nearCompleteOwnPaths = 0;
  let totalOwnPathsAdvanced = 0;

  for (const line of allLines) {
    if (!line.some(([r, c]) => r === targetRow && c === targetCol)) continue;
    if (!isLineViableForTeam(line, teamIndex, tempBoard, lockedCells, sequencesCompleted)) continue;

    const filled = countFilled(line, teamIndex, tempBoard);
    totalOwnPathsAdvanced++;

    if (filled >= seqLen - 1) {
      nearCompleteOwnPaths++; // 4/5 filled = 1 away from completion
    } else if (filled >= seqLen - 2) {
      score += 800; // 3/5 filled path
    }

    // Hand synergy for this path
    const empty = getEmptyCells(line, teamIndex, tempBoard);
    score += scoreHandSynergy(empty, botPlayer.hand, boardChips);
  }

  if (nearCompleteOwnPaths >= 2) {
    score += 8000; // Fork: 2+ near-complete paths
  } else if (nearCompleteOwnPaths === 1) {
    score += 2000 + 3000; // Single near-complete + path bonus
  }

  score += totalOwnPathsAdvanced * 150;

  // --- Priority 4: Deny opponent viable paths ---
  for (const oppTeam of opponentTeams) {
    for (const line of allLines) {
      if (!line.some(([r, c]) => r === targetRow && c === targetCol)) continue;
      // Was this line viable for opponent before our move?
      if (!isLineViableForTeam(line, oppTeam, boardChips, lockedCells, sequencesCompleted)) continue;
      // Is it still viable after our move? (It shouldn't be — we placed our chip)
      if (!isLineViableForTeam(line, oppTeam, tempBoard, lockedCells, sequencesCompleted)) {
        const oppFilled = countFilled(line, oppTeam, boardChips);
        if (oppFilled >= seqLen - 2) {
          score += 300; // Denied near-complete opponent path
        } else {
          score += 50; // Denied any opponent path
        }
      }
    }
  }

  // --- Priority 5: Critical cell intersection bonus ---
  // Count how many of our own viable paths this cell sits on
  let ownViablePathCount = 0;
  for (const line of allLines) {
    if (!line.some(([r, c]) => r === targetRow && c === targetCol)) continue;
    if (isLineViableForTeam(line, teamIndex, tempBoard, lockedCells, sequencesCompleted)) {
      ownViablePathCount++;
    }
  }
  // Quadratic bonus capped at ~360 (for cells on 6+ paths)
  score += Math.min(360, ownViablePathCount * ownViablePathCount * 10);

  // --- Priority 7: Positional ---
  score += centerBonus(targetRow, targetCol);

  // Two-eyed jack penalty (save for high-value plays)
  if (action.type === 'play-two-eyed' && !completesSequence && score < 10000) {
    score -= 500;
  }

  return score;
}

/**
 * Score a removal (one-eyed jack) move for the impossible bot.
 */
function scoreRemovalImpossible(
  row: number,
  col: number,
  gameState: GameState,
  botPlayer: Player,
  allLines: Line[],
  opponentTeams: number[],
): number {
  const { boardChips, lockedCells, sequencesCompleted, config } = gameState;
  const seqLen = config.sequenceLength;
  const removedTeam = boardChips[row][col];
  if (removedTeam === null) return 0;

  let score = 0;

  // Score based on breaking opponent paths
  for (const line of allLines) {
    if (!line.some(([r, c]) => r === row && c === col)) continue;

    // Check if this line was viable for the removed team
    if (!isLineViableForTeam(line, removedTeam, boardChips, lockedCells, sequencesCompleted)) continue;

    const filled = countFilled(line, removedTeam, boardChips);
    if (filled >= seqLen - 1) {
      score += 5000; // Break 4/5 path
    } else if (filled >= seqLen - 2) {
      score += 1000; // Break 3/5 path
    } else {
      score += 100; // Break any viable path
    }
  }

  // Bonus: does removal open own paths?
  const tempBoard = boardChips.map(r => [...r]);
  tempBoard[row][col] = null;

  for (const line of allLines) {
    if (!line.some(([r, c]) => r === row && c === col)) continue;
    // Was blocked before, viable now?
    if (isLineViableForTeam(line, removedTeam, boardChips, lockedCells, sequencesCompleted) &&
        !isLineViableForTeam(line, removedTeam, tempBoard, lockedCells, sequencesCompleted)) {
      // This is the denial we already scored above
    }
    // Check if our own team's path is opened
    if (!isLineViableForTeam(line, botPlayer.teamIndex, boardChips, lockedCells, sequencesCompleted) &&
        isLineViableForTeam(line, botPlayer.teamIndex, tempBoard, lockedCells, sequencesCompleted)) {
      score += 80;
    }
  }

  return score;
}

/**
 * Top-level impossible bot: score all moves, pick the best deterministically.
 */
function pickImpossibleMove(moves: GameAction[], gameState: GameState, botPlayer: Player): GameAction {
  const allLines = enumerateAllLines(gameState.config.sequenceLength);

  const opponentTeams: number[] = [];
  for (const p of gameState.players) {
    if (p.teamIndex !== botPlayer.teamIndex && !opponentTeams.includes(p.teamIndex)) {
      opponentTeams.push(p.teamIndex);
    }
  }

  const scored = moves.map(action => {
    let score: number;
    if (action.type === 'play-one-eyed') {
      score = scoreRemovalImpossible(
        (action as { targetRow: number }).targetRow,
        (action as { targetCol: number }).targetCol,
        gameState, botPlayer, allLines, opponentTeams,
      );
    } else if (action.type === 'play-normal' || action.type === 'play-two-eyed') {
      score = scoreMoveImpossible(
        action as GameAction & { targetRow: number; targetCol: number },
        gameState, botPlayer, allLines, opponentTeams,
      );
    } else {
      score = 0;
    }
    return { action, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].action;
}
