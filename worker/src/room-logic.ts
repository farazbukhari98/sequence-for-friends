import {
  Room,
  RoomInfo,
  Player,
  PublicPlayer,
  VALID_PLAYER_COUNTS,
  GameState,
  ClientGameState,
  cellKey,
  TurnTimeLimit,
  SequencesToWin,
  SequenceLength,
  SeriesLength,
  SeriesState,
  GameVariant,
  BotDifficulty,
  DEFAULT_SEQUENCES_TO_WIN,
  DEFAULT_SEQUENCE_LENGTH,
  DEFAULT_SERIES_LENGTH,
  DEFAULT_GAME_VARIANT,
} from '../../shared/types.js';
import { createGameConfig, initializeGame, assignTeams, interleavePlayersByTeam } from './gameState.js';
import { createBotPlayer, generateBotName } from './bot.js';

/**
 * Generate a random room code (5 alphanumeric characters)
 */
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

/**
 * Create a player object
 */
export function createPlayer(name: string, isHost: boolean = false, userId?: string): Player {
  return {
    id: crypto.randomUUID(),
    name,
    token: crypto.randomUUID(),
    userId,
    seatIndex: 0,
    teamIndex: 0,
    teamColor: 'blue',
    connected: true,
    ready: isHost,
    hand: [],
    discardPile: [],
  };
}

/**
 * Convert player to public player info
 */
export function toPublicPlayer(player: Player): PublicPlayer {
  return {
    id: player.id,
    name: player.name,
    seatIndex: player.seatIndex,
    teamIndex: player.teamIndex,
    teamColor: player.teamColor,
    connected: player.connected,
    ready: player.ready,
    handCount: player.hand.length,
    topDiscard: player.discardPile.length > 0
      ? player.discardPile[player.discardPile.length - 1]
      : null,
    discardCount: player.discardPile.length,
    isBot: player.isBot || undefined,
  };
}

/**
 * Convert room to public room info
 */
export function toRoomInfo(room: Room): RoomInfo {
  return {
    code: room.code,
    name: room.name,
    hostId: room.hostId,
    phase: room.phase,
    players: room.players.map(toPublicPlayer),
    maxPlayers: room.maxPlayers,
    teamCount: room.teamCount,
    gameVariant: room.gameVariant,
    turnTimeLimit: room.turnTimeLimit,
    sequencesToWin: room.sequencesToWin,
    sequenceLength: room.sequenceLength,
    seriesLength: room.seriesLength,
    seriesState: room.seriesState,
  };
}

/**
 * Convert game state to client-specific state (with player's own hand)
 */
export function toClientGameState(gameState: GameState, playerId: string): ClientGameState {
  const player = gameState.players.find(p => p.id === playerId);

  const lockedCellsArray: string[][] = [];
  for (let i = 0; i < gameState.config.teamCount; i++) {
    const cells = gameState.lockedCells.get(i);
    lockedCellsArray.push(cells ? Array.from(cells) : []);
  }

  const sequencesCompletedArray: number[] = [];
  for (let i = 0; i < gameState.config.teamCount; i++) {
    sequencesCompletedArray.push(gameState.sequencesCompleted.get(i) || 0);
  }

  const teamScoresArray: number[] = [];
  for (let i = 0; i < gameState.config.teamCount; i++) {
    teamScoresArray.push(gameState.teamScores.get(i) || 0);
  }

  return {
    phase: gameState.phase,
    config: gameState.config,
    players: gameState.players.map(toPublicPlayer),
    dealerIndex: gameState.dealerIndex,
    currentPlayerIndex: gameState.currentPlayerIndex,
    deckCount: gameState.deck.length,
    boardChips: gameState.boardChips,
    lockedCells: lockedCellsArray,
    sequencesCompleted: sequencesCompletedArray,
    teamScores: teamScoresArray,
    completedSequences: gameState.completedSequences,
    kingZone: gameState.kingZone,
    myHand: player?.hand || [],
    myPlayerId: playerId,
    deadCardReplacedThisTurn: gameState.deadCardReplacedThisTurn,
    pendingDraw: gameState.pendingDraw,
    lastRemovedCell: gameState.lastRemovedCell,
    winnerTeamIndex: gameState.winnerTeamIndex,
    lastMove: gameState.lastMove,
    cutCards: gameState.cutCards,
    turnTimeLimit: gameState.turnTimeLimit,
    turnStartedAt: gameState.turnStartedAt,
    eventLog: gameState.eventLog.slice(-30),
  };
}

/**
 * Create a new room object (pure data, no storage)
 */
export function createRoomData(
  code: string,
  roomName: string,
  hostPlayer: Player,
  maxPlayers: number,
  teamCount: number,
  turnTimeLimit: TurnTimeLimit = 0,
  sequencesToWin: SequencesToWin = DEFAULT_SEQUENCES_TO_WIN,
  sequenceLength: SequenceLength = DEFAULT_SEQUENCE_LENGTH,
  seriesLength: SeriesLength = DEFAULT_SERIES_LENGTH,
  gameVariant: GameVariant = DEFAULT_GAME_VARIANT
): Room {
  if (!VALID_PLAYER_COUNTS.includes(maxPlayers)) {
    throw new Error(`Invalid player count: ${maxPlayers}. Valid counts: ${VALID_PLAYER_COUNTS.join(', ')}`);
  }

  if (maxPlayers > 3 && maxPlayers % teamCount !== 0) {
    throw new Error(`Player count ${maxPlayers} must be divisible by team count ${teamCount}`);
  }

  if (![1, 2, 3, 4].includes(sequencesToWin)) {
    throw new Error(`Invalid sequences to win: ${sequencesToWin}. Must be 1, 2, 3, or 4`);
  }

  if (![4, 5].includes(sequenceLength)) {
    throw new Error(`Invalid sequence length: ${sequenceLength}. Must be 4 or 5`);
  }

  const now = Date.now();

  const room: Room = {
    code,
    name: roomName.trim() || `${hostPlayer.name}'s Game`,
    hostId: hostPlayer.id,
    phase: 'waiting',
    players: [hostPlayer],
    maxPlayers,
    teamCount,
    gameVariant,
    turnTimeLimit,
    sequencesToWin,
    sequenceLength,
    seriesLength,
    seriesState: null,
    gameState: null,
    createdAt: now,
    lastActivityAt: now,
  };

  assignTeams(room.players, teamCount);

  return room;
}

/**
 * Add a player to the room
 */
export function addPlayerToRoom(room: Room, playerName: string, token?: string, userId?: string): Player | { error: string } {
  // Check for reconnection
  if (token) {
    const existingPlayer = room.players.find(p => p.token === token);
    if (existingPlayer) {
      existingPlayer.connected = true;
      if (userId && existingPlayer.userId !== userId) {
        existingPlayer.userId = userId;
      }
      return existingPlayer;
    }
  }

  if (room.phase !== 'waiting') {
    return { error: 'Game already in progress' };
  }

  if (room.players.length >= room.maxPlayers) {
    return { error: 'Room is full' };
  }

  if (room.players.some(p => p.name.toLowerCase() === playerName.toLowerCase())) {
    return { error: 'Name already taken in this room' };
  }

  const player = createPlayer(playerName, false, userId);
  room.players.push(player);
  assignTeams(room.players, room.teamCount);

  return player;
}

/**
 * Remove a player from the room
 */
export function removePlayerFromRoom(room: Room, playerId: string): boolean {
  const playerIndex = room.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) return false;

  const player = room.players[playerIndex];

  if (room.phase === 'in-game') {
    player.connected = false;
    return true;
  }

  room.players.splice(playerIndex, 1);

  if (room.players.length === 0) {
    return true;
  }

  if (room.hostId === playerId) {
    room.hostId = room.players[0].id;
  }

  assignTeams(room.players, room.teamCount);
  return true;
}

/**
 * Kick a player (host only)
 */
export function kickPlayerFromRoom(room: Room, hostId: string, playerId: string): { error?: string } {
  if (room.hostId !== hostId) {
    return { error: 'Only the host can kick players' };
  }

  if (playerId === hostId) {
    return { error: 'Cannot kick yourself' };
  }

  const removed = removePlayerFromRoom(room, playerId);
  if (!removed) return { error: 'Player not found' };

  return {};
}

/**
 * Update room settings
 */
export function updateRoomSettings(
  room: Room,
  hostId: string,
  settings: { turnTimeLimit?: TurnTimeLimit; sequencesToWin?: SequencesToWin; sequenceLength?: SequenceLength; seriesLength?: SeriesLength; gameVariant?: GameVariant }
): { error?: string } {
  if (room.hostId !== hostId) {
    return { error: 'Only the host can change settings' };
  }

  if (room.phase !== 'waiting') {
    return { error: 'Cannot change settings after game started' };
  }

  if (settings.gameVariant !== undefined) {
    if (!['classic', 'king-of-the-board'].includes(settings.gameVariant)) {
      return { error: `Invalid game variant: ${settings.gameVariant}` };
    }

    if (settings.gameVariant === 'king-of-the-board') {
      if (room.maxPlayers < 4) {
        return { error: 'King of the Board requires rooms with at least 4 seats' };
      }
      if (room.players.some(player => player.isBot)) {
        return { error: 'King of the Board is not available in bot games' };
      }
      room.sequenceLength = 5;
    }

    room.gameVariant = settings.gameVariant;
  }

  if (settings.turnTimeLimit !== undefined) {
    room.turnTimeLimit = settings.turnTimeLimit;
  }

  if (settings.sequencesToWin !== undefined) {
    if (![1, 2, 3, 4].includes(settings.sequencesToWin)) {
      return { error: `Invalid sequences to win: ${settings.sequencesToWin}. Must be 1, 2, 3, or 4` };
    }
    room.sequencesToWin = settings.sequencesToWin;
  }

  if (settings.sequenceLength !== undefined) {
    if (![4, 5].includes(settings.sequenceLength)) {
      return { error: `Invalid sequence length: ${settings.sequenceLength}. Must be 4 or 5` };
    }
    if (room.gameVariant === 'king-of-the-board' && settings.sequenceLength !== 5) {
      return { error: 'King of the Board requires standard 5-chip sequences' };
    }
    room.sequenceLength = settings.sequenceLength;
  }

  if (settings.seriesLength !== undefined) {
    if (![0, 3, 5, 7].includes(settings.seriesLength)) {
      return { error: `Invalid series length: ${settings.seriesLength}. Must be 0, 3, 5, or 7` };
    }
    room.seriesLength = settings.seriesLength;
  }

  return {};
}

/**
 * Start the game
 */
export function startGameInRoom(room: Room, hostId: string): GameState | { error: string } {
  if (room.hostId !== hostId) {
    return { error: 'Only the host can start the game' };
  }

  if (room.phase !== 'waiting') {
    return { error: 'Game already started' };
  }

  if (!VALID_PLAYER_COUNTS.includes(room.players.length)) {
    return { error: `Invalid player count: ${room.players.length}. Need one of: ${VALID_PLAYER_COUNTS.join(', ')}` };
  }

  if (!room.players.every(p => p.ready)) {
    return { error: 'All players must be ready to start' };
  }

  if (room.gameVariant === 'king-of-the-board') {
    if (room.players.length < 4) {
      return { error: 'King of the Board requires at least 4 players to start' };
    }
    if (room.players.some(player => player.isBot)) {
      return { error: 'King of the Board is not available in bot games' };
    }
  }

  const config = createGameConfig(room.players.length, room.sequencesToWin, room.sequenceLength, room.gameVariant);
  interleavePlayersByTeam(room.players, config.teamCount);
  const gameState = initializeGame(room.players, config, room.turnTimeLimit);

  if (room.seriesLength > 0 && !room.seriesState) {
    room.seriesState = {
      seriesLength: room.seriesLength,
      gamesPlayed: 0,
      teamWins: Array(room.teamCount).fill(0),
      seriesWinnerTeamIndex: null,
    };
  }

  room.phase = 'in-game';
  room.gameState = gameState;

  return gameState;
}

/**
 * Continue series
 */
export function continueSeriesInRoom(room: Room, hostId: string): GameState | { error: string } {
  if (room.hostId !== hostId) {
    return { error: 'Only the host can continue the series' };
  }

  if (room.phase !== 'in-game') {
    return { error: 'Game not in progress' };
  }

  if (!room.seriesState) {
    return { error: 'No series in progress' };
  }

  if (room.seriesState.seriesWinnerTeamIndex !== null) {
    return { error: 'Series has already ended' };
  }

  if (!room.gameState || room.gameState.winnerTeamIndex === null) {
    return { error: 'Current game is not finished' };
  }

  const winnerTeam = room.gameState.winnerTeamIndex;
  room.seriesState.teamWins[winnerTeam]++;
  room.seriesState.gamesPlayed++;

  const winsNeeded = Math.ceil(room.seriesLength / 2);
  if (room.seriesState.teamWins[winnerTeam] >= winsNeeded) {
    room.seriesState.seriesWinnerTeamIndex = winnerTeam;
    room.phase = 'waiting';
    room.gameState = null;

    for (const player of room.players) {
      player.ready = player.id === room.hostId;
      player.hand = [];
      player.discardPile = [];
    }

    return { error: 'Series over' };
  }

  const config = createGameConfig(room.players.length, room.sequencesToWin, room.sequenceLength, room.gameVariant);
  interleavePlayersByTeam(room.players, config.teamCount);
  const gameState = initializeGame(room.players, config, room.turnTimeLimit);

  room.gameState = gameState;

  return gameState;
}

/**
 * End series early
 */
export function endSeriesInRoom(room: Room, hostId: string): { error?: string } {
  if (room.hostId !== hostId) {
    return { error: 'Only the host can end the series' };
  }

  if (room.seriesState && room.gameState?.winnerTeamIndex != null) {
    room.seriesState.teamWins[room.gameState.winnerTeamIndex]++;
    room.seriesState.gamesPlayed++;
    let leadingTeam = 0;
    for (let i = 1; i < room.seriesState.teamWins.length; i++) {
      if (room.seriesState.teamWins[i] > room.seriesState.teamWins[leadingTeam]) {
        leadingTeam = i;
      }
    }
    room.seriesState.seriesWinnerTeamIndex = leadingTeam;
  }

  room.phase = 'waiting';
  room.gameState = null;

  for (const player of room.players) {
    player.ready = player.id === room.hostId;
    player.hand = [];
    player.discardPile = [];
  }

  return {};
}

/**
 * Add a bot to the room
 */
export function addBotToRoom(room: Room, difficulty: BotDifficulty): Player | { error: string } {
  if (room.gameVariant === 'king-of-the-board') {
    return { error: 'King of the Board is not available in bot games' };
  }

  if (room.players.length >= room.maxPlayers) {
    return { error: 'Room is full' };
  }

  const existingNames = room.players.map(p => p.name);
  const botName = generateBotName(existingNames);
  const bot = createBotPlayer(botName, difficulty);

  room.players.push(bot);
  assignTeams(room.players, room.teamCount);
  room.lastActivityAt = Date.now();

  return bot;
}

/**
 * Remove a bot from the room
 */
export function removeBotFromRoom(room: Room, botPlayerId: string): { error?: string } {
  const playerIndex = room.players.findIndex(p => p.id === botPlayerId);
  if (playerIndex === -1) return { error: 'Player not found' };

  const player = room.players[playerIndex];
  if (!player.isBot) return { error: 'Player is not a bot' };

  room.players.splice(playerIndex, 1);
  assignTeams(room.players, room.teamCount);
  room.lastActivityAt = Date.now();

  return {};
}

/**
 * Toggle ready status
 */
export function togglePlayerReady(room: Room, playerId: string): { error?: string } {
  if (room.phase !== 'waiting') {
    return { error: 'Game already started' };
  }

  const player = room.players.find(p => p.id === playerId);
  if (!player) return { error: 'Player not found' };

  player.ready = !player.ready;
  room.lastActivityAt = Date.now();

  return {};
}

/**
 * Switch player team
 */
export function switchPlayerTeam(room: Room, playerId: string, newTeamIndex: number): { error?: string } {
  if (room.phase !== 'waiting') {
    return { error: 'Cannot switch teams after game started' };
  }

  const player = room.players.find(p => p.id === playerId);
  if (!player) return { error: 'Player not found' };

  if (newTeamIndex < 0 || newTeamIndex >= room.teamCount) {
    return { error: 'Invalid team index' };
  }

  const teamColors = room.teamCount === 2 ? ['blue', 'green'] : ['blue', 'green', 'red'];
  player.teamIndex = newTeamIndex;
  player.teamColor = teamColors[newTeamIndex] as 'blue' | 'green' | 'red';
  room.lastActivityAt = Date.now();

  return {};
}

/**
 * Determine active game modes
 */
export function getActiveModes(settings: { sequenceLength: number; turnTimeLimit: number; seriesLength: number; gameVariant: GameVariant }): string[] {
  const modes: string[] = [];

  if (settings.gameVariant === 'king-of-the-board') {
    modes.push('king-of-the-board');
  } else if (settings.sequenceLength === 4 && settings.turnTimeLimit === 15) {
    modes.push('speed-sequence');
  } else if (settings.sequenceLength === 4) {
    modes.push('blitz');
  }

  if (settings.seriesLength > 0) {
    modes.push('series');
  }

  return modes;
}
