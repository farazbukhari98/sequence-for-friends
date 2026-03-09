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
  TurnTimeLimit,
  SequencesToWin,
  SequenceLength,
  GameVariant,
  DEFAULT_SEQUENCES_TO_WIN,
  DEFAULT_SEQUENCE_LENGTH,
  DEFAULT_GAME_VARIANT,
  KING_OF_THE_BOARD_SCORE_TO_WIN,
} from '../../shared/types.js';

import { createDeck, shuffleDeck, dealCards, cutCard } from './rules/deck.js';
import { getInitialKingZone } from './rules/kingOfTheBoard.js';

/**
 * Create the initial game configuration based on player count
 */
export function createGameConfig(
  playerCount: number,
  sequencesToWin?: SequencesToWin,
  sequenceLength?: SequenceLength,
  gameVariant: GameVariant = DEFAULT_GAME_VARIANT
): GameConfig {
  const teamCount = getTeamCount(playerCount);
  const teamColors = teamCount === 2 ? TEAM_COLORS_2 : TEAM_COLORS_3;
  const handSize = HAND_SIZES[playerCount];
  const effectiveSequenceLength = gameVariant === 'king-of-the-board'
    ? 5
    : (sequenceLength ?? DEFAULT_SEQUENCE_LENGTH);

  return {
    playerCount,
    teamCount,
    teamColors,
    gameVariant,
    sequencesToWin: sequencesToWin ?? DEFAULT_SEQUENCES_TO_WIN,
    scoreToWin: gameVariant === 'king-of-the-board'
      ? KING_OF_THE_BOARD_SCORE_TO_WIN
      : (sequencesToWin ?? DEFAULT_SEQUENCES_TO_WIN),
    sequenceLength: effectiveSequenceLength,
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
export function initializeGame(
  players: Player[],
  config: GameConfig,
  turnTimeLimit: TurnTimeLimit = 0
): GameState {
  const { cutCards, dealerIndex } = performCut(players);
  const deck = shuffleDeck(createDeck());

  for (const player of players) {
    player.hand = dealCards(deck, config.handSize);
    player.discardPile = [];
  }

  const currentPlayerIndex = (dealerIndex + 1) % players.length;
  const teamScores = new Map<number, number>();
  for (let i = 0; i < config.teamCount; i++) {
    teamScores.set(i, 0);
  }

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
    teamScores,
    completedSequences: [],
    kingZone: config.gameVariant === 'king-of-the-board' ? getInitialKingZone() : null,
    deadCardReplacedThisTurn: false,
    pendingDraw: false,
    lastRemovedCell: null,
    cutCards,
    winnerTeamIndex: null,
    lastMove: null,
    turnTimeLimit,
    turnStartedAt: turnTimeLimit > 0 ? Date.now() : null,
    sequenceTimestamps: new Map(),
    scoreTimestamps: new Map(),
    eventLog: [],
    firstPlayerId: players[currentPlayerIndex]?.id || null,
  };
}

/**
 * Assign teams to players based on seating order
 */
export function assignTeams(players: Player[], teamCount: number): void {
  const teamColors = teamCount === 2 ? TEAM_COLORS_2 : TEAM_COLORS_3;

  for (let i = 0; i < players.length; i++) {
    players[i].seatIndex = i;
    players[i].teamIndex = i % teamCount;
    players[i].teamColor = teamColors[i % teamCount];
  }
}

/**
 * Reorder players in-place so teams alternate (A,B,A,B or A,B,C,A,B,C).
 * Updates seatIndex to match new positions.
 */
export function interleavePlayersByTeam(players: Player[], teamCount: number): void {
  const teams: Player[][] = Array.from({ length: teamCount }, () => []);
  for (const p of players) {
    teams[p.teamIndex].push(p);
  }
  let idx = 0;
  const maxSize = Math.max(...teams.map(t => t.length));
  for (let round = 0; round < maxSize; round++) {
    for (let t = 0; t < teamCount; t++) {
      if (round < teams[t].length) {
        players[idx] = teams[t][round];
        players[idx].seatIndex = idx;
        idx++;
      }
    }
  }
}

/**
 * Find the next player index ensuring teams alternate turns.
 * Tries the next team in rotation, finds the nearest connected player on that team.
 * Falls back to any connected player if all other teams are disconnected.
 */
export function getNextPlayerIndex(
  currentIndex: number,
  players: { teamIndex: number; connected: boolean; isBot?: boolean }[],
  teamCount: number
): number {
  const n = players.length;
  if (n <= 1) return 0;
  const currentTeam = players[currentIndex].teamIndex;

  // Try teams in rotation order (next team first, then subsequent)
  for (let t = 1; t <= teamCount; t++) {
    const targetTeam = (currentTeam + t) % teamCount;
    if (targetTeam === currentTeam) continue;

    // Find nearest connected player on this team, scanning forward
    for (let i = 1; i < n; i++) {
      const idx = (currentIndex + i) % n;
      const p = players[idx];
      if (p.teamIndex === targetTeam && (p.connected || p.isBot)) {
        return idx;
      }
    }
  }

  // Fallback: any connected player (all other teams disconnected)
  for (let i = 1; i < n; i++) {
    const idx = (currentIndex + i) % n;
    const p = players[idx];
    if (p.connected || p.isBot) {
      return idx;
    }
  }

  // No one connected, advance normally (will trigger disconnect-skip)
  return (currentIndex + 1) % n;
}
