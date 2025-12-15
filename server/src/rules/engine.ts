import {
  GameState,
  GameAction,
  PlayAction,
  ReplaceDeadAction,
  MoveResult,
  CardCode,
  BoardChips,
  SequenceLine,
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
    // Remove opponent's chip
    gameState.boardChips[playAction.targetRow][playAction.targetCol] = null;
    gameState.lastRemovedCell = [playAction.targetRow, playAction.targetCol];
  } else {
    // Place our chip
    gameState.boardChips[playAction.targetRow][playAction.targetCol] = player.teamIndex;

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
      gameState.config.sequencesToWin
    );

    if (newSequences.length > 0) {
      // Take only the first valid sequence (in case multiple were detected)
      const sequence = newSequences[0];

      // Lock the sequence cells
      lockSequenceCells(gameState.lockedCells, sequence);

      // Update completed sequences count
      const newCount = (gameState.sequencesCompleted.get(player.teamIndex) || 0) + 1;
      gameState.sequencesCompleted.set(player.teamIndex, newCount);

      // Add to completed sequences list
      gameState.completedSequences.push(sequence);

      result.newSequences = [sequence];

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
