import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

import type {
  ClientToServerEvents,
  ServerToClientEvents,
  GameAction,
} from '../../shared/types.js';

import {
  createRoom,
  joinRoom,
  leaveRoom,
  kickPlayer,
  startGame,
  getRoom,
  getRoomByToken,
  disconnectPlayer,
  reconnectPlayer,
  toRoomInfo,
  toClientGameState,
  cleanupOldRooms,
  updateRoomSettings,
} from './rooms.js';

import { applyMove } from './rules/engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? false
      : ['http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST'],
  },
});

// Serve the built client (always in production, optionally in dev)
// The compiled server is at dist/server/src/, so we need to go up to project root
const clientPath = path.join(__dirname, '../../../../client/dist');
app.use(express.static(clientPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(clientPath, 'index.html'));
});

// Track socket to player/room mapping
const socketToPlayer = new Map<string, { roomCode: string; playerId: string }>();

// Track turn timers per room
const roomTimers = new Map<string, NodeJS.Timeout>();

/**
 * Clear any existing timer for a room
 */
function clearTurnTimer(roomCode: string): void {
  const existingTimer = roomTimers.get(roomCode);
  if (existingTimer) {
    clearTimeout(existingTimer);
    roomTimers.delete(roomCode);
  }
}

/**
 * Start a turn timer for a room
 */
function startTurnTimer(roomCode: string): void {
  const room = getRoom(roomCode);
  if (!room || !room.gameState || room.gameState.turnTimeLimit === 0) {
    return;
  }

  // Clear any existing timer
  clearTurnTimer(roomCode);

  const timeLimit = room.gameState.turnTimeLimit * 1000; // Convert to milliseconds

  const timer = setTimeout(() => {
    handleTurnTimeout(roomCode);
  }, timeLimit);

  roomTimers.set(roomCode, timer);
}

/**
 * Handle turn timeout - skip the player's turn
 */
function handleTurnTimeout(roomCode: string): void {
  const room = getRoom(roomCode);
  if (!room || !room.gameState || room.gameState.phase !== 'playing') {
    return;
  }

  const gameState = room.gameState;
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const playerName = currentPlayer.name;
  const playerIndex = gameState.currentPlayerIndex;

  // Skip to next player without any action
  // Reset turn state
  gameState.deadCardReplacedThisTurn = false;
  gameState.pendingDraw = false;
  gameState.lastRemovedCell = null;

  // Move to next player
  gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;

  // Reset turn timer for next player
  gameState.turnStartedAt = gameState.turnTimeLimit > 0 ? Date.now() : null;

  // Notify all players about timeout
  io.to(roomCode).emit('turn-timeout', { playerIndex, playerName });

  // Send updated game state to all players
  for (const player of room.players) {
    const playerSocket = findSocketByPlayerId(player.id);
    if (playerSocket) {
      playerSocket.emit('game-state-updated', toClientGameState(gameState, player.id));
    }
  }

  // Start timer for next player
  startTurnTimer(roomCode);

  console.log(`Turn timeout for ${playerName} in room ${roomCode}`);
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Create a new room
  socket.on('create-room', (data, callback) => {
    try {
      const { room, player } = createRoom(
        data.playerName,
        data.maxPlayers,
        data.teamCount,
        data.turnTimeLimit ?? 0
      );

      // Join socket to room
      socket.join(room.code);
      socketToPlayer.set(socket.id, { roomCode: room.code, playerId: player.id });

      const roomInfo = toRoomInfo(room);

      callback({
        success: true,
        roomCode: room.code,
        playerId: player.id,
        token: player.token,
      });

      // Send room info to the creator
      socket.emit('room-updated', roomInfo);

      console.log(`Room ${room.code} created by ${player.name}`);
    } catch (error) {
      callback({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create room',
      });
    }
  });

  // Join an existing room
  socket.on('join-room', (data, callback) => {
    const result = joinRoom(data.roomCode, data.playerName, data.token);

    if ('error' in result) {
      callback({ success: false, error: result.error });
      return;
    }

    const { room, player } = result;

    // Join socket to room
    socket.join(room.code);
    socketToPlayer.set(socket.id, { roomCode: room.code, playerId: player.id });

    callback({
      success: true,
      roomInfo: toRoomInfo(room),
      playerId: player.id,
      token: player.token,
    });

    // Notify other players
    socket.to(room.code).emit('room-updated', toRoomInfo(room));

    console.log(`${player.name} joined room ${room.code}`);
  });

  // Reconnect to a room
  socket.on('reconnect-to-room', (data, callback) => {
    const tokenResult = getRoomByToken(data.token);

    if (!tokenResult) {
      callback({ success: false, error: 'Invalid token or room expired' });
      return;
    }

    const { room, playerId } = tokenResult;

    // Verify room code matches
    if (room.code !== data.roomCode.toUpperCase()) {
      callback({ success: false, error: 'Token does not match room' });
      return;
    }

    // Mark player as reconnected
    reconnectPlayer(room.code, playerId);

    // Join socket to room
    socket.join(room.code);
    socketToPlayer.set(socket.id, { roomCode: room.code, playerId });

    const roomInfo = toRoomInfo(room);
    const gameState = room.gameState
      ? toClientGameState(room.gameState, playerId)
      : undefined;

    callback({
      success: true,
      roomInfo,
      gameState,
      playerId,
    });

    // Notify other players
    socket.to(room.code).emit('player-reconnected', playerId);

    const player = room.players.find(p => p.id === playerId);
    console.log(`${player?.name} reconnected to room ${room.code}`);
  });

  // Leave room
  socket.on('leave-room', () => {
    const playerInfo = socketToPlayer.get(socket.id);
    if (!playerInfo) return;

    const room = leaveRoom(playerInfo.roomCode, playerInfo.playerId);
    socket.leave(playerInfo.roomCode);
    socketToPlayer.delete(socket.id);

    if (room) {
      io.to(playerInfo.roomCode).emit('room-updated', toRoomInfo(room));
    }
  });

  // Update room settings (host only, before game starts)
  socket.on('update-room-settings', (data, callback) => {
    const playerInfo = socketToPlayer.get(socket.id);
    if (!playerInfo) {
      callback({ success: false, error: 'Not in a room' });
      return;
    }

    const result = updateRoomSettings(playerInfo.roomCode, playerInfo.playerId, {
      turnTimeLimit: data.turnTimeLimit,
    });

    if ('error' in result) {
      callback({ success: false, error: result.error });
      return;
    }

    callback({ success: true });

    // Notify all players about the updated settings
    io.to(playerInfo.roomCode).emit('room-updated', toRoomInfo(result));
  });

  // Kick player (host only)
  socket.on('kick-player', (playerId) => {
    const playerInfo = socketToPlayer.get(socket.id);
    if (!playerInfo) return;

    const result = kickPlayer(playerInfo.roomCode, playerInfo.playerId, playerId);

    if ('error' in result) {
      socket.emit('error', result.error);
      return;
    }

    io.to(playerInfo.roomCode).emit('room-updated', toRoomInfo(result));
    io.to(playerInfo.roomCode).emit('player-left', playerId);
  });

  // Start game (host only)
  socket.on('start-game', (callback) => {
    const playerInfo = socketToPlayer.get(socket.id);
    if (!playerInfo) {
      callback({ success: false, error: 'Not in a room' });
      return;
    }

    const result = startGame(playerInfo.roomCode, playerInfo.playerId);

    if ('error' in result) {
      callback({ success: false, error: result.error });
      return;
    }

    callback({ success: true });

    // Send game state to each player with their private hand
    const room = getRoom(playerInfo.roomCode);
    if (room && room.gameState) {
      // Send cut results first
      io.to(playerInfo.roomCode).emit('cut-result', room.gameState.cutCards, room.gameState.dealerIndex);

      // Send individual game states
      for (const player of room.players) {
        const playerSocket = findSocketByPlayerId(player.id);
        if (playerSocket) {
          playerSocket.emit('game-started', toClientGameState(room.gameState, player.id));
        }
      }

      // Start turn timer if enabled
      startTurnTimer(playerInfo.roomCode);
    }

    console.log(`Game started in room ${playerInfo.roomCode}`);
  });

  // Handle game action
  socket.on('game-action', (action, callback) => {
    const playerInfo = socketToPlayer.get(socket.id);
    if (!playerInfo) {
      callback({ success: false, error: 'Not in a room' });
      return;
    }

    const room = getRoom(playerInfo.roomCode);
    if (!room || !room.gameState) {
      callback({ success: false, error: 'Game not in progress' });
      return;
    }

    // Track the current player before the move to detect turn change
    const previousPlayerIndex = room.gameState.currentPlayerIndex;

    // Apply the move
    const result = applyMove(room.gameState, playerInfo.playerId, action);

    callback(result);

    if (result.success) {
      // Check if turn changed (player drew a card, completing their turn)
      const turnChanged = room.gameState.currentPlayerIndex !== previousPlayerIndex;

      if (turnChanged && !result.gameOver) {
        // Update turn start time for the new player
        room.gameState.turnStartedAt = room.gameState.turnTimeLimit > 0 ? Date.now() : null;
        // Restart the timer for the new player
        startTurnTimer(playerInfo.roomCode);
      }

      // Send updated game state to all players
      for (const player of room.players) {
        const playerSocket = findSocketByPlayerId(player.id);
        if (playerSocket) {
          playerSocket.emit('game-state-updated', toClientGameState(room.gameState, player.id));
        }
      }

      // Check for game over
      if (result.gameOver && result.winnerTeamIndex !== undefined) {
        // Clear timer on game over
        clearTurnTimer(playerInfo.roomCode);
        io.to(playerInfo.roomCode).emit('game-over', result.winnerTeamIndex);
      }
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    const playerInfo = socketToPlayer.get(socket.id);
    if (playerInfo) {
      const room = disconnectPlayer(playerInfo.roomCode, playerInfo.playerId);
      socketToPlayer.delete(socket.id);

      if (room) {
        io.to(playerInfo.roomCode).emit('player-disconnected', playerInfo.playerId);
        io.to(playerInfo.roomCode).emit('room-updated', toRoomInfo(room));
      }
    }
    console.log('Client disconnected:', socket.id);
  });
});

// Helper function to find socket by player ID
function findSocketByPlayerId(playerId: string): ReturnType<typeof io.sockets.sockets.get> | undefined {
  for (const [socketId, info] of socketToPlayer) {
    if (info.playerId === playerId) {
      return io.sockets.sockets.get(socketId);
    }
  }
  return undefined;
}

// Cleanup old rooms every hour
setInterval(() => {
  cleanupOldRooms();
}, 60 * 60 * 1000);

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
