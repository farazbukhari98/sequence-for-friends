import {
  GameState,
  GameConfig,
  Player,
  BoardChips,
  CutCard,
  CardCode,
  HAND_SIZES,
  TEAM_COLORS_2,
  TEAM_COLORS_3,
  getTeamCount,
  getRankValue,
} from '../../shared/types.js';

import { createDeck, shuffleDeck, dealCards, cutCard } from './rules/deck.js';

/**
 * Create the initial game configuration based on player count
 */
export function createGameConfig(playerCount: number): GameConfig {
  const teamCount = getTeamCount(playerCount);
  const teamColors = teamCount === 2 ? TEAM_COLORS_2 : TEAM_COLORS_3;
  const sequencesToWin = teamCount === 2 ? 2 : 1;
  const handSize = HAND_SIZES[playerCount];

  return {
    playerCount,
    teamCount,
    teamColors,
    sequencesToWin,
    handSize,
  };
}

/**
 * Create an empty 10x10 board
 */
function createEmptyBoard(): BoardChips {
  return Array(10).fill(null).map(() => Array(10).fill(null));
}

/**
 * Perform the cut to determine dealer
 * Each player draws a card, lowest card deals (Aces high)
 */
export function performCut(players: Player[]): { cutCards: CutCard[]; dealerIndex: number } {
  const deck = shuffleDeck(createDeck());
  const cutCards: CutCard[] = [];

  for (const player of players) {
    const card = cutCard(deck);
    cutCards.push({
      playerId: player.id,
      card,
      rank: getRankValue(card),
    });
  }

  // Find the player with the lowest card (dealer)
  // In case of tie, first player in array wins
  let lowestRank = Infinity;
  let dealerIndex = 0;

  for (let i = 0; i < cutCards.length; i++) {
    if (cutCards[i].rank < lowestRank) {
      lowestRank = cutCards[i].rank;
      dealerIndex = i;
    }
  }

  return { cutCards, dealerIndex };
}

/**
 * Initialize a new game state from room players
 */
export function initializeGame(players: Player[], config: GameConfig): GameState {
  // Perform the cut
  const { cutCards, dealerIndex } = performCut(players);

  // Create and shuffle deck
  const deck = shuffleDeck(createDeck());

  // Deal cards to each player
  for (const player of players) {
    player.hand = dealCards(deck, config.handSize);
    player.discardPile = [];
  }

  // Player to the left of dealer starts
  const currentPlayerIndex = (dealerIndex + 1) % players.length;

  return {
    phase: 'playing',
    config,
    players,
    dealerIndex,
    currentPlayerIndex,
    deck,
    boardChips: createEmptyBoard(),
    lockedCells: new Map(),
    sequencesCompleted: new Map(),
    completedSequences: [],
    deadCardReplacedThisTurn: false,
    pendingDraw: false,
    lastRemovedCell: null,
    cutCards,
    winnerTeamIndex: null,
    lastMove: null,
  };
}

/**
 * Assign teams to players based on seating order
 * For 2 teams: alternating (0,1,0,1...)
 * For 3 teams: cycling (0,1,2,0,1,2...)
 */
export function assignTeams(players: Player[], teamCount: number): void {
  const teamColors = teamCount === 2 ? TEAM_COLORS_2 : TEAM_COLORS_3;

  for (let i = 0; i < players.length; i++) {
    players[i].seatIndex = i;
    players[i].teamIndex = i % teamCount;
    players[i].teamColor = teamColors[i % teamCount];
  }
}
