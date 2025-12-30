import { v4 as uuidv4 } from 'uuid';
import {
  GameState,
  GameAction,
  PlayAction,
  ReplaceDeadAction,
  MoveResult,
  CardCode,
  BoardChips,
  SequenceLine,
  StalemateResult,
  GameEvent,
  GameEventType,
  Player,
  BOARD_LAYOUT,
  isJack,
  getJackType,
  findCardPositions,
  isCorner,
  cellKey,
} from '../../../shared/types.js';

import { drawCard, reshuffleDiscards } from './deck.js';
import { detectNewSequences, isCellLocked, lockSequenceCells } from './sequences.js';

/**
 * Create a game event for the activity log
 */
function createGameEvent(
  type: GameEventType,
  player: Player,
  details?: {
    card?: CardCode;
    position?: [number, number];
    targetTeamIndex?: number;
    sequenceCount?: number;
  }
): GameEvent {
  return {
    id: uuidv4(),
    type,
    timestamp: Date.now(),
    playerId: player.id,
    playerName: player.name,
    teamIndex: player.teamIndex,
    teamColor: player.teamColor,
    ...details,
  };
}

/**
 * Add event to game log (keeps last 50 events)
 */
function logEvent(gameState: GameState, event: GameEvent): void {
  gameState.eventLog.push(event);
  if (gameState.eventLog.length > 50) {
    gameState.eventLog.shift();
  }
}

// Direction vectors for checking sequences (matching sequences.ts)
const DIRECTIONS: [number, number][] = [
  [0, 1],   // Horizontal right
  [1, 0],   // Vertical down
  [1, 1],   // Diagonal down-right
  [1, -1],  // Diagonal down-left
];

/**
 * Check if a card is dead (both board positions occupied)
 */
export function isDeadCard(card: CardCode, boardChips: BoardChips): boolean {
  // Jacks are never dead (they don't appear on the board)
  if (isJack(card)) return false;

  const positions = findCardPositions(card);

  // Check if all positions are occupied
  return positions.every(([row, col]) => boardChips[row][col] !== null);
}

/**
 * Get all dead cards in a hand
 */
export function getDeadCards(hand: CardCode[], boardChips: BoardChips): CardCode[] {
  return hand.filter(card => isDeadCard(card, boardChips));
}

/**
 * Get legal target positions for a card
 */
export function getLegalTargets(
  card: CardCode,
  boardChips: BoardChips,
  teamIndex: number,
  lockedCells: Map<number, Set<string>>,
  lastRemovedCell: [number, number] | null
): [number, number][] {
  const jackType = getJackType(card);

  if (jackType === 'two-eyed') {
    // Can place on ANY open space
    const targets: [number, number][] = [];
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        // Skip corners (always occupied for everyone)
        if (isCorner(row, col)) continue;
        // Skip occupied cells
        if (boardChips[row][col] !== null) continue;
        // Skip cell that was just removed this turn
        if (lastRemovedCell && lastRemovedCell[0] === row && lastRemovedCell[1] === col) continue;
        targets.push([row, col]);
      }
    }
    return targets;
  }

  if (jackType === 'one-eyed') {
    // Can remove any opponent chip that's not locked
    const targets: [number, number][] = [];
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        // Skip corners (can't remove)
        if (isCorner(row, col)) continue;
        // Skip empty cells
        if (boardChips[row][col] === null) continue;
        // Skip own chips
        if (boardChips[row][col] === teamIndex) continue;
        // Skip locked cells (part of completed sequence)
        if (isCellLocked(lockedCells, row, col)) continue;
        targets.push([row, col]);
      }
    }
    return targets;
  }

  // Normal card - find matching positions that are open
  const positions = findCardPositions(card);
  return positions.filter(([row, col]) =>
    boardChips[row][col] === null && !isCorner(row, col)
  );
}

/**
 * Validate if a move is legal
 */
export function isLegalMove(
  gameState: GameState,
  playerId: string,
  action: GameAction
): { valid: boolean; error?: string } {
  const player = gameState.players.find(p => p.id === playerId);
  if (!player) {
    return { valid: false, error: 'Player not found' };
  }

  // Check if it's this player's turn
  if (gameState.players[gameState.currentPlayerIndex].id !== playerId) {
    return { valid: false, error: 'Not your turn' };
  }

  // Handle draw action
  if (action.type === 'draw') {
    if (!gameState.pendingDraw) {
      return { valid: false, error: 'You must play a card first' };
    }
    return { valid: true };
  }

  // Handle dead card replacement
  if (action.type === 'replace-dead') {
    if (gameState.deadCardReplacedThisTurn) {
      return { valid: false, error: 'You can only replace one dead card per turn' };
    }
    if (!player.hand.includes(action.card)) {
      return { valid: false, error: 'You don\'t have that card' };
    }
    if (!isDeadCard(action.card, gameState.boardChips)) {
      return { valid: false, error: 'That card is not dead' };
    }
    return { valid: true };
  }

  // Handle play actions
  if (action.type === 'play-normal' || action.type === 'play-two-eyed' || action.type === 'play-one-eyed') {
    // Can't play if pending draw
    if (gameState.pendingDraw) {
      return { valid: false, error: 'You must draw a card to complete your turn' };
    }

    // Check player has the card
    if (!player.hand.includes(action.card)) {
      return { valid: false, error: 'You don\'t have that card' };
    }

    // Get legal targets
    const legalTargets = getLegalTargets(
      action.card,
      gameState.boardChips,
      player.teamIndex,
      gameState.lockedCells,
      gameState.lastRemovedCell
    );

    // Check if target is legal
    const isTargetLegal = legalTargets.some(
      ([row, col]) => row === action.targetRow && col === action.targetCol
    );

    if (!isTargetLegal) {
      return { valid: false, error: 'Invalid target position' };
    }

    // Verify action type matches card type
    const jackType = getJackType(action.card);
    if (action.type === 'play-two-eyed' && jackType !== 'two-eyed') {
      return { valid: false, error: 'That card is not a two-eyed jack' };
    }
    if (action.type === 'play-one-eyed' && jackType !== 'one-eyed') {
      return { valid: false, error: 'That card is not a one-eyed jack' };
    }
    if (action.type === 'play-normal' && jackType !== null) {
      return { valid: false, error: 'Use the correct jack action' };
    }

    return { valid: true };
  }

  return { valid: false, error: 'Unknown action type' };
}

/**
 * Get a line of N cells starting from position in direction
 */
function getLineOfN(
  startRow: number,
  startCol: number,
  dRow: number,
  dCol: number,
  length: number
): [number, number][] | null {
  const cells: [number, number][] = [];

  for (let i = 0; i < length; i++) {
    const row = startRow + i * dRow;
    const col = startCol + i * dCol;

    if (row < 0 || row >= 10 || col < 0 || col >= 10) {
      return null; // Line goes off board
    }

    cells.push([row, col]);
  }

  return cells;
}

/**
 * Check if a team can potentially complete a line as a valid sequence
 */
function canCompleteLineAsSequence(
  line: [number, number][],
  boardChips: BoardChips,
  teamIndex: number,
  lockedCells: Set<string>,
  sequencesCompleted: number,
  allLockedCells: Map<number, Set<string>>
): boolean {
  let overlapWithPrevious = 0;
  let alreadyLockedCells = 0;

  for (const [row, col] of line) {
    const cell = boardChips[row][col];
    const key = cellKey(row, col);
    const isCornerCell = isCorner(row, col);

    if (isCornerCell) {
      // Corners count for everyone - no issues
      continue;
    }

    // Check if blocked by opponent's chip
    if (cell !== null && cell !== teamIndex) {
      // If opponent's chip is locked, we can never complete this line
      if (isCellLocked(allLockedCells, row, col)) {
        return false;
      }
      // Otherwise, we could potentially remove it with a one-eyed jack
      // For stalemate detection, we assume we can't (conservative)
      // But actually, let's be more generous - if we have unplayed one-eyed jacks
      // we might be able to remove it. For simplicity, consider it blocked.
      return false;
    }

    if (lockedCells.has(key)) {
      // Part of our previous sequence
      alreadyLockedCells++;
      overlapWithPrevious++;
    }
  }

  // Check overlap rule: can only share 1 non-corner cell with previous sequences
  if (sequencesCompleted > 0 && overlapWithPrevious > 1) {
    return false;
  }

  // If all non-corner cells are already locked by us, this line is already counted
  const nonCornerCount = line.filter(([r, c]) => !isCorner(r, c)).length;
  if (alreadyLockedCells >= nonCornerCount) {
    return false; // Already have this sequence
  }

  return true;
}

/**
 * Check if a specific team can complete any valid sequence
 */
function canTeamCompleteSequence(
  boardChips: BoardChips,
  teamIndex: number,
  lockedCells: Set<string>,
  sequencesCompleted: number,
  allLockedCells: Map<number, Set<string>>,
  sequenceLength: number
): boolean {
  // Check all possible N-cell lines on the board
  for (const [dRow, dCol] of DIRECTIONS) {
    for (let startRow = 0; startRow < 10; startRow++) {
      for (let startCol = 0; startCol < 10; startCol++) {
        // Check if N-cell line starting here is valid
        const line = getLineOfN(startRow, startCol, dRow, dCol, sequenceLength);
        if (!line) continue;

        const canComplete = canCompleteLineAsSequence(
          line,
          boardChips,
          teamIndex,
          lockedCells,
          sequencesCompleted,
          allLockedCells
        );

        if (canComplete) return true;
      }
    }
  }

  return false;
}

/**
 * Check if stalemate has occurred - no team can reach the required sequences
 *
 * A stalemate occurs when:
 * 1. No team can complete another valid sequence (considering overlap rules)
 * 2. All possible sequence lines are blocked
 *
 * When stalemate is detected:
 * - Team with most sequences wins
 * - If tied, team that reached that count first wins (via timestamps)
 */
export function checkStalemate(gameState: GameState): StalemateResult {
  const { config, boardChips, lockedCells, sequencesCompleted, sequenceTimestamps } = gameState;
  const teamCount = config.teamCount;
  const sequenceLength = config.sequenceLength;

  // Get current sequence counts
  const sequenceCounts: number[] = [];
  for (let i = 0; i < teamCount; i++) {
    sequenceCounts.push(sequencesCompleted.get(i) || 0);
  }

  // Check if any team can still complete a valid sequence
  let canAnyTeamScore = false;

  for (let teamIndex = 0; teamIndex < teamCount; teamIndex++) {
    const completed = sequencesCompleted.get(teamIndex) || 0;
    if (completed >= config.sequencesToWin) continue; // Already won (shouldn't happen)

    const teamLockedCells = lockedCells.get(teamIndex) || new Set<string>();

    if (canTeamCompleteSequence(boardChips, teamIndex, teamLockedCells, completed, lockedCells, sequenceLength)) {
      canAnyTeamScore = true;
      break;
    }
  }

  if (canAnyTeamScore) {
    return { isStalemate: false };
  }

  // Stalemate detected - determine winner
  const maxSequences = Math.max(...sequenceCounts);

  // If no one has any sequences, it's a true stalemate (shouldn't happen in practice)
  if (maxSequences === 0) {
    return {
      isStalemate: true,
      winnerTeamIndex: 0, // Default to first team
      reason: 'highest_count',
      sequenceCounts,
    };
  }

  const teamsWithMax = sequenceCounts
    .map((count, index) => ({ count, index }))
    .filter(t => t.count === maxSequences);

  if (teamsWithMax.length === 1) {
    // Clear winner - team with most sequences
    return {
      isStalemate: true,
      winnerTeamIndex: teamsWithMax[0].index,
      reason: 'highest_count',
      sequenceCounts,
    };
  }

  // Tie - find who reached maxSequences first
  let earliestTime = Infinity;
  let winnerIndex = teamsWithMax[0].index;

  for (const team of teamsWithMax) {
    const timestamps = sequenceTimestamps.get(team.index) || [];
    // Get the timestamp when they reached maxSequences
    const timeToReachMax = timestamps[maxSequences - 1] || Infinity;
    if (timeToReachMax < earliestTime) {
      earliestTime = timeToReachMax;
      winnerIndex = team.index;
    }
  }

  return {
    isStalemate: true,
    winnerTeamIndex: winnerIndex,
    reason: 'first_to_reach',
    sequenceCounts,
  };
}

/**
 * Apply a move to the game state
 * This mutates the game state directly
 */
export function applyMove(
  gameState: GameState,
  playerId: string,
  action: GameAction
): MoveResult {
  // Validate the move first
  const validation = isLegalMove(gameState, playerId, action);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const player = gameState.players.find(p => p.id === playerId)!;
  const result: MoveResult = { success: true, action, playerId };

  // Handle draw action
  if (action.type === 'draw') {
    // Check if deck needs reshuffling
    if (gameState.deck.length === 0) {
      const discardPiles = gameState.players.map(p => [...p.discardPile]);
      gameState.players.forEach(p => p.discardPile = []);
      gameState.deck = reshuffleDiscards(discardPiles);
    }

    // Draw a card
    const card = drawCard(gameState.deck);
    if (card) {
      player.hand.push(card);
    }

    // End turn
    gameState.pendingDraw = false;
    gameState.deadCardReplacedThisTurn = false;
    gameState.lastRemovedCell = null;

    // Move to next player
    gameState.currentPlayerIndex =
      (gameState.currentPlayerIndex + 1) % gameState.players.length;

    // Check for stalemate after each turn ends
    if (gameState.phase === 'playing') {
      const stalemateResult = checkStalemate(gameState);
      if (stalemateResult.isStalemate && stalemateResult.winnerTeamIndex !== undefined) {
        gameState.winnerTeamIndex = stalemateResult.winnerTeamIndex;
        gameState.phase = 'finished';
        result.gameOver = true;
        result.winnerTeamIndex = stalemateResult.winnerTeamIndex;
        result.stalemate = stalemateResult;
      }
    }

    return result;
  }

  // Handle dead card replacement
  if (action.type === 'replace-dead') {
    const deadAction = action as ReplaceDeadAction;

    // Remove card from hand
    const cardIndex = player.hand.indexOf(deadAction.card);
    player.hand.splice(cardIndex, 1);

    // Add to discard pile
    player.discardPile.push(deadAction.card);

    // Draw replacement
    if (gameState.deck.length === 0) {
      const discardPiles = gameState.players.map(p => [...p.discardPile]);
      gameState.players.forEach(p => p.discardPile = []);
      gameState.deck = reshuffleDiscards(discardPiles);
    }

    const card = drawCard(gameState.deck);
    if (card) {
      player.hand.push(card);
    }

    gameState.deadCardReplacedThisTurn = true;

    // Log event
    logEvent(gameState, createGameEvent('card-replaced', player, {
      card: deadAction.card,
    }));

    return result;
  }

  // Handle play actions
  const playAction = action as PlayAction;
  const jackType = getJackType(playAction.card);

  // Remove card from hand
  const cardIndex = player.hand.indexOf(playAction.card);
  player.hand.splice(cardIndex, 1);

  // Add to discard pile
  player.discardPile.push(playAction.card);

  // Execute the action
  if (playAction.type === 'play-one-eyed') {
    // Get opponent's team index before removing
    const targetTeamIndex = gameState.boardChips[playAction.targetRow][playAction.targetCol] as number;

    // Remove opponent's chip
    gameState.boardChips[playAction.targetRow][playAction.targetCol] = null;
    gameState.lastRemovedCell = [playAction.targetRow, playAction.targetCol];

    // Log removal event
    logEvent(gameState, createGameEvent('chip-removed', player, {
      card: playAction.card,
      position: [playAction.targetRow, playAction.targetCol],
      targetTeamIndex,
    }));
  } else {
    // Place our chip
    gameState.boardChips[playAction.targetRow][playAction.targetCol] = player.teamIndex;

    // Log placement event
    logEvent(gameState, createGameEvent('chip-placed', player, {
      card: playAction.card,
      position: [playAction.targetRow, playAction.targetCol],
    }));

    // Check for new sequences
    const teamLockedCells = gameState.lockedCells.get(player.teamIndex) || new Set<string>();
    const sequencesCompleted = gameState.sequencesCompleted.get(player.teamIndex) || 0;

    const newSequences = detectNewSequences(
      gameState.boardChips,
      playAction.targetRow,
      playAction.targetCol,
      player.teamIndex,
      teamLockedCells,
      sequencesCompleted,
      gameState.config.sequencesToWin,
      gameState.config.sequenceLength
    );

    if (newSequences.length > 0) {
      // Take only the first valid sequence (in case multiple were detected)
      const sequence = newSequences[0];

      // Lock the sequence cells
      lockSequenceCells(gameState.lockedCells, sequence);

      // Update completed sequences count
      const newCount = (gameState.sequencesCompleted.get(player.teamIndex) || 0) + 1;
      gameState.sequencesCompleted.set(player.teamIndex, newCount);

      // Record timestamp for this sequence (for stalemate tie-breaker)
      const timestamps = gameState.sequenceTimestamps.get(player.teamIndex) || [];
      timestamps.push(Date.now());
      gameState.sequenceTimestamps.set(player.teamIndex, timestamps);

      // Add to completed sequences list
      gameState.completedSequences.push(sequence);

      result.newSequences = [sequence];

      // Log sequence completed event
      logEvent(gameState, createGameEvent('sequence-completed', player, {
        sequenceCount: newCount,
      }));

      // Check win condition
      if (newCount >= gameState.config.sequencesToWin) {
        gameState.winnerTeamIndex = player.teamIndex;
        gameState.phase = 'finished';
        result.gameOver = true;
        result.winnerTeamIndex = player.teamIndex;
      }
    }
  }

  // Set pending draw
  gameState.pendingDraw = true;

  // Store last move for display
  gameState.lastMove = result;

  return result;
}

/**
 * Check if the current player has any playable cards
 */
export function hasPlayableCards(gameState: GameState, playerId: string): boolean {
  const player = gameState.players.find(p => p.id === playerId);
  if (!player) return false;

  for (const card of player.hand) {
    const targets = getLegalTargets(
      card,
      gameState.boardChips,
      player.teamIndex,
      gameState.lockedCells,
      gameState.lastRemovedCell
    );
    if (targets.length > 0) return true;
  }

  return false;
}
