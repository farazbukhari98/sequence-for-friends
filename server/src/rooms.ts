import { v4 as uuidv4 } from 'uuid';
import {
  Room,
  RoomInfo,
  Player,
  PublicPlayer,
  VALID_PLAYER_COUNTS,
  GameState,
  ClientGameState,
  cellKey,
} from '../../shared/types.js';
import { createGameConfig, initializeGame, assignTeams } from './gameState.js';

// In-memory room storage
const rooms = new Map<string, Room>();

// Player token to room mapping for reconnection
const playerTokens = new Map<string, { roomCode: string; playerId: string }>();

/**
 * Generate a random room code (5-6 alphanumeric characters)
 */
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing characters
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Generate a unique room code
 */
function getUniqueRoomCode(): string {
  let code: string;
  let attempts = 0;
  do {
    code = generateRoomCode();
    attempts++;
    if (attempts > 100) {
      // Add extra character if too many collisions
      code += generateRoomCode()[0];
    }
  } while (rooms.has(code));
  return code;
}

/**
 * Create a player object
 */
function createPlayer(name: string, isHost: boolean = false): Player {
  return {
    id: uuidv4(),
    name,
    token: uuidv4(),
    seatIndex: 0,
    teamIndex: 0,
    teamColor: 'blue',
    connected: true,
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
    handCount: player.hand.length,
    topDiscard: player.discardPile.length > 0
      ? player.discardPile[player.discardPile.length - 1]
      : null,
    discardCount: player.discardPile.length,
  };
}

/**
 * Convert room to public room info
 */
export function toRoomInfo(room: Room): RoomInfo {
  return {
    code: room.code,
    hostId: room.hostId,
    phase: room.phase,
    players: room.players.map(toPublicPlayer),
    maxPlayers: room.maxPlayers,
    teamCount: room.teamCount,
  };
}

/**
 * Convert game state to client-specific state (with player's own hand)
 */
export function toClientGameState(gameState: GameState, playerId: string): ClientGameState {
  const player = gameState.players.find(p => p.id === playerId);

  // Convert locked cells Map to array format
  const lockedCellsArray: string[][] = [];
  for (let i = 0; i < gameState.config.teamCount; i++) {
    const cells = gameState.lockedCells.get(i);
    lockedCellsArray.push(cells ? Array.from(cells) : []);
  }

  // Convert sequences completed to array
  const sequencesCompletedArray: number[] = [];
  for (let i = 0; i < gameState.config.teamCount; i++) {
    sequencesCompletedArray.push(gameState.sequencesCompleted.get(i) || 0);
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
    completedSequences: gameState.completedSequences,
    myHand: player?.hand || [],
    myPlayerId: playerId,
    deadCardReplacedThisTurn: gameState.deadCardReplacedThisTurn,
    pendingDraw: gameState.pendingDraw,
    lastRemovedCell: gameState.lastRemovedCell,
    winnerTeamIndex: gameState.winnerTeamIndex,
    lastMove: gameState.lastMove,
    cutCards: gameState.cutCards,
  };
}

/**
 * Create a new room
 */
export function createRoom(
  hostName: string,
  maxPlayers: number,
  teamCount: number
): { room: Room; player: Player } {
  // Validate player count
  if (!VALID_PLAYER_COUNTS.includes(maxPlayers)) {
    throw new Error(`Invalid player count: ${maxPlayers}. Valid counts: ${VALID_PLAYER_COUNTS.join(', ')}`);
  }

  // Validate team count for player count
  if (maxPlayers > 3 && maxPlayers % teamCount !== 0) {
    throw new Error(`Player count ${maxPlayers} must be divisible by team count ${teamCount}`);
  }

  const code = getUniqueRoomCode();
  const host = createPlayer(hostName, true);

  const room: Room = {
    code,
    hostId: host.id,
    phase: 'waiting',
    players: [host],
    maxPlayers,
    teamCount,
    gameState: null,
    createdAt: Date.now(),
  };

  // Assign initial team
  assignTeams(room.players, teamCount);

  rooms.set(code, room);
  playerTokens.set(host.token, { roomCode: code, playerId: host.id });

  return { room, player: host };
}

/**
 * Join an existing room
 */
export function joinRoom(
  roomCode: string,
  playerName: string,
  token?: string
): { room: Room; player: Player } | { error: string } {
  const room = rooms.get(roomCode.toUpperCase());

  if (!room) {
    return { error: 'Room not found' };
  }

  // Check for reconnection
  if (token) {
    const tokenInfo = playerTokens.get(token);
    if (tokenInfo && tokenInfo.roomCode === roomCode.toUpperCase()) {
      const existingPlayer = room.players.find(p => p.id === tokenInfo.playerId);
      if (existingPlayer) {
        existingPlayer.connected = true;
        return { room, player: existingPlayer };
      }
    }
  }

  if (room.phase !== 'waiting') {
    return { error: 'Game already in progress' };
  }

  if (room.players.length >= room.maxPlayers) {
    return { error: 'Room is full' };
  }

  // Check for duplicate names
  if (room.players.some(p => p.name.toLowerCase() === playerName.toLowerCase())) {
    return { error: 'Name already taken in this room' };
  }

  const player = createPlayer(playerName);
  room.players.push(player);

  // Reassign teams
  assignTeams(room.players, room.teamCount);

  playerTokens.set(player.token, { roomCode: room.code, playerId: player.id });

  return { room, player };
}

/**
 * Remove a player from a room
 */
export function leaveRoom(roomCode: string, playerId: string): Room | null {
  const room = rooms.get(roomCode);
  if (!room) return null;

  const playerIndex = room.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) return null;

  const player = room.players[playerIndex];

  // If game is in progress, just mark as disconnected
  if (room.phase === 'in-game') {
    player.connected = false;
    return room;
  }

  // Remove player from room
  room.players.splice(playerIndex, 1);

  // Remove token mapping
  playerTokens.delete(player.token);

  // If no players left, delete room
  if (room.players.length === 0) {
    rooms.delete(roomCode);
    return null;
  }

  // If host left, assign new host
  if (room.hostId === playerId) {
    room.hostId = room.players[0].id;
  }

  // Reassign teams
  assignTeams(room.players, room.teamCount);

  return room;
}

/**
 * Kick a player from the room (host only)
 */
export function kickPlayer(
  roomCode: string,
  hostId: string,
  playerId: string
): Room | { error: string } {
  const room = rooms.get(roomCode);
  if (!room) return { error: 'Room not found' };

  if (room.hostId !== hostId) {
    return { error: 'Only the host can kick players' };
  }

  if (playerId === hostId) {
    return { error: 'Cannot kick yourself' };
  }

  const result = leaveRoom(roomCode, playerId);
  if (!result) return { error: 'Player not found' };

  return result;
}

/**
 * Start the game
 */
export function startGame(roomCode: string, hostId: string): GameState | { error: string } {
  const room = rooms.get(roomCode);
  if (!room) return { error: 'Room not found' };

  if (room.hostId !== hostId) {
    return { error: 'Only the host can start the game' };
  }

  if (room.phase !== 'waiting') {
    return { error: 'Game already started' };
  }

  if (!VALID_PLAYER_COUNTS.includes(room.players.length)) {
    return { error: `Invalid player count: ${room.players.length}. Need one of: ${VALID_PLAYER_COUNTS.join(', ')}` };
  }

  // Create game config
  const config = createGameConfig(room.players.length);

  // Initialize game state
  const gameState = initializeGame(room.players, config);

  room.phase = 'in-game';
  room.gameState = gameState;

  return gameState;
}

/**
 * Get a room by code
 */
export function getRoom(roomCode: string): Room | undefined {
  return rooms.get(roomCode.toUpperCase());
}

/**
 * Get room by player token (for reconnection)
 */
export function getRoomByToken(token: string): { room: Room; playerId: string } | null {
  const tokenInfo = playerTokens.get(token);
  if (!tokenInfo) return null;

  const room = rooms.get(tokenInfo.roomCode);
  if (!room) return null;

  return { room, playerId: tokenInfo.playerId };
}

/**
 * Mark player as disconnected
 */
export function disconnectPlayer(roomCode: string, playerId: string): Room | null {
  const room = rooms.get(roomCode);
  if (!room) return null;

  const player = room.players.find(p => p.id === playerId);
  if (player) {
    player.connected = false;
  }

  return room;
}

/**
 * Mark player as reconnected
 */
export function reconnectPlayer(roomCode: string, playerId: string): Room | null {
  const room = rooms.get(roomCode);
  if (!room) return null;

  const player = room.players.find(p => p.id === playerId);
  if (player) {
    player.connected = true;
  }

  return room;
}

/**
 * Clean up old rooms (call periodically)
 */
export function cleanupOldRooms(maxAgeMs: number = 24 * 60 * 60 * 1000): void {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - room.createdAt > maxAgeMs) {
      // Clean up player tokens
      for (const player of room.players) {
        playerTokens.delete(player.token);
      }
      rooms.delete(code);
    }
  }
}
