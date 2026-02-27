import type { DurableObject } from 'cloudflare:workers';
import type { Env } from './index.js';

import type {
  Room,
  Player,
  GameState,
  TeamSwitchRequest,
} from '../../shared/types.js';

import type { ClientMessage } from './protocol.js';

import {
  createPlayer,
  createRoomData,
  addPlayerToRoom,
  removePlayerFromRoom,
  kickPlayerFromRoom,
  updateRoomSettings,
  startGameInRoom,
  continueSeriesInRoom,
  endSeriesInRoom,
  addBotToRoom,
  removeBotFromRoom,
  togglePlayerReady,
  switchPlayerTeam,
  toRoomInfo,
  toClientGameState,
  getActiveModes,
} from './room-logic.js';

import { applyMove } from './rules/engine.js';
import { decideBotAction, getBotDelay } from './bot.js';

// ============================================
// TIMER TYPES FOR ALARM QUEUE
// ============================================

interface TimerEntry {
  type: 'turn-timeout' | 'bot-turn' | 'disconnect-skip' | 'cleanup';
  fireAt: number;
}

// ============================================
// SERIALIZATION HELPERS
// ============================================

interface SerializedRoom {
  room: Room;
  // Maps serialized as arrays of [key, value]
  lockedCells?: [number, string[]][];
  sequencesCompleted?: [number, number][];
  sequenceTimestamps?: [number, number[]][];
}

function serializeRoom(room: Room): SerializedRoom {
  // Deep-enough copy: shallow-copy room AND gameState so we don't mutate live state
  const roomCopy = { ...room };
  if (room.gameState) {
    roomCopy.gameState = { ...room.gameState };
  }
  const result: SerializedRoom = { room: roomCopy };

  if (room.gameState) {
    const gs = room.gameState;
    // Convert Maps to arrays for JSON serialization
    result.lockedCells = Array.from(gs.lockedCells.entries()).map(
      ([k, v]) => [k, Array.from(v)]
    );
    result.sequencesCompleted = Array.from(gs.sequencesCompleted.entries());
    result.sequenceTimestamps = Array.from(gs.sequenceTimestamps.entries());

    // Null out Maps on the COPY only (not the live gameState)
    (result.room.gameState as any).lockedCells = null;
    (result.room.gameState as any).sequencesCompleted = null;
    (result.room.gameState as any).sequenceTimestamps = null;
  }

  return result;
}

function deserializeRoom(data: SerializedRoom): Room {
  const room = data.room;

  if (room.gameState) {
    room.gameState.lockedCells = new Map(
      (data.lockedCells || []).map(([k, v]) => [k, new Set(v)])
    );
    room.gameState.sequencesCompleted = new Map(data.sequencesCompleted || []);
    room.gameState.sequenceTimestamps = new Map(data.sequenceTimestamps || []);
  }

  return room;
}

// ============================================
// ROOM DURABLE OBJECT
// ============================================

export class RoomDO implements DurableObject {
  private state: DurableObjectState;
  private env: Env;

  // In-memory state (lazy-loaded from storage)
  private room: Room | null = null;
  private loaded = false;

  // WebSocket -> playerId mapping
  private wsToPlayer = new Map<WebSocket, string>();
  // playerId -> WebSocket mapping
  private playerToWs = new Map<string, WebSocket>();

  // Pending team switch requests
  private pendingTeamSwitches = new Map<string, TeamSwitchRequest>();

  // Timer queue (managed via alarm)
  private timers: TimerEntry[] = [];

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  // ========== STATE MANAGEMENT ==========

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    const data = await this.state.storage.get<SerializedRoom>('room');
    if (data) {
      this.room = deserializeRoom(data);
    }
    const timers = await this.state.storage.get<TimerEntry[]>('timers');
    if (timers) {
      this.timers = timers;
    }
    this.loaded = true;
    this.restoreWebSocketMappings();
  }

  /**
   * Reconstruct wsToPlayer/playerToWs Maps from WebSocket attachments.
   * After DO hibernation, in-memory Maps are lost but the Hibernation API
   * preserves serializable attachments on each WebSocket.
   */
  private restoreWebSocketMappings(): void {
    if (this.playerToWs.size > 0) return; // Already populated

    const sockets = this.state.getWebSockets();
    for (const ws of sockets) {
      const attachment = ws.deserializeAttachment() as { playerId?: string } | null;
      if (attachment?.playerId) {
        this.wsToPlayer.set(ws, attachment.playerId);
        this.playerToWs.set(attachment.playerId, ws);
      }
    }
  }

  private async saveState(): Promise<void> {
    if (this.room) {
      await this.state.storage.put('room', serializeRoom(this.room));
    } else {
      await this.state.storage.delete('room');
    }
    await this.state.storage.put('timers', this.timers);
  }

  // ========== TIMER MANAGEMENT ==========

  private async scheduleTimer(type: TimerEntry['type'], delayMs: number): Promise<void> {
    // Remove existing timer of same type
    this.timers = this.timers.filter(t => t.type !== type);

    const fireAt = Date.now() + delayMs;
    this.timers.push({ type, fireAt });
    this.timers.sort((a, b) => a.fireAt - b.fireAt);

    // Schedule alarm for earliest timer
    if (this.timers.length > 0) {
      await this.state.storage.setAlarm(this.timers[0].fireAt);
    }
    await this.state.storage.put('timers', this.timers);
  }

  private async clearTimer(type: TimerEntry['type']): Promise<void> {
    this.timers = this.timers.filter(t => t.type !== type);
    if (this.timers.length > 0) {
      await this.state.storage.setAlarm(this.timers[0].fireAt);
    } else {
      await this.state.storage.deleteAlarm();
    }
    await this.state.storage.put('timers', this.timers);
  }

  private async clearAllTimers(): Promise<void> {
    this.timers = [];
    await this.state.storage.deleteAlarm();
    await this.state.storage.put('timers', this.timers);
  }

  // ========== ALARM HANDLER ==========

  async alarm(): Promise<void> {
    await this.ensureLoaded();
    if (!this.room) return;

    const now = Date.now();
    const expired = this.timers.filter(t => t.fireAt <= now);
    this.timers = this.timers.filter(t => t.fireAt > now);

    for (const timer of expired) {
      switch (timer.type) {
        case 'turn-timeout':
        case 'disconnect-skip':
          this.handleTurnTimeout();
          break;
        case 'bot-turn':
          this.executeBotTurn();
          break;
        case 'cleanup':
          await this.cleanupRoom();
          break;
      }
    }

    // Schedule next alarm
    if (this.timers.length > 0) {
      await this.state.storage.setAlarm(this.timers[0].fireAt);
    }

    await this.saveState();
  }

  // ========== HTTP/WS ENTRY POINT ==========

  async fetch(request: Request): Promise<Response> {
    await this.ensureLoaded();

    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const roomCode = request.headers.get('X-Room-Code') || '';
    const action = request.headers.get('X-Action') || '';
    const reconnectPlayerId = request.headers.get('X-Player-Id') || '';
    const reconnectToken = request.headers.get('X-Player-Token') || '';

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];

    // Accept the WebSocket with hibernation
    this.state.acceptWebSocket(server, [action, roomCode, reconnectPlayerId, reconnectToken]);

    return new Response(null, { status: 101, webSocket: client });
  }

  // ========== WEBSOCKET HIBERNATION HANDLERS ==========

  async webSocketOpen(ws: WebSocket): Promise<void> {
    // Connection opened - client will send their first message to identify
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    await this.ensureLoaded();

    const raw = typeof message === 'string' ? message : new TextDecoder().decode(message);
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw);
    } catch {
      this.sendTo(ws, { type: 'error', data: { message: 'Invalid JSON' } });
      return;
    }

    try {
      await this.handleMessage(ws, msg);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Internal error';
      if ('id' in msg && msg.id) {
        this.sendResponse(ws, msg.id, { success: false, error: errorMsg });
      } else {
        this.sendTo(ws, { type: 'error', data: { message: errorMsg } });
      }
    }

    await this.saveState();
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    await this.ensureLoaded();

    const playerId = this.wsToPlayer.get(ws);
    if (!playerId || !this.room) {
      this.wsToPlayer.delete(ws);
      return;
    }

    // If this WebSocket was superseded by a reconnection, ignore this close event
    const currentWs = this.playerToWs.get(playerId);
    if (currentWs && currentWs !== ws) {
      this.wsToPlayer.delete(ws);
      return;
    }

    const isHost = this.room.hostId === playerId;
    const isInGame = this.room.phase === 'in-game';

    this.wsToPlayer.delete(ws);
    this.playerToWs.delete(playerId);

    // If host disconnects during game, close room
    if (isHost && isInGame) {
      await this.clearAllTimers();
      this.broadcast({ type: 'room-closed', data: 'Host left the game' });
      this.closeAllConnections();
      await this.destroyRoom();
      return;
    }

    // Mark player as disconnected
    const player = this.room.players.find(p => p.id === playerId);
    if (player && !player.isBot) {
      player.connected = false;
    }

    this.broadcast({ type: 'player-disconnected', data: playerId });
    this.broadcast({ type: 'room-updated', data: toRoomInfo(this.room) });

    // If it's this player's turn, auto-skip after 3 seconds
    if (isInGame && this.room.gameState && this.room.gameState.phase === 'playing') {
      const currentPlayer = this.room.gameState.players[this.room.gameState.currentPlayerIndex];
      if (currentPlayer.id === playerId) {
        await this.clearTimer('turn-timeout');
        await this.scheduleTimer('disconnect-skip', 3000);
      }
    }

    // Schedule cleanup if no connected players
    const hasConnected = this.room.players.some(p => p.connected && !p.isBot);
    if (!hasConnected) {
      await this.scheduleTimer('cleanup', 30 * 60 * 1000); // 30 minutes
    }

    await this.saveState();
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    // Treat errors like close
    await this.webSocketClose(ws, 1006, 'error', false);
  }

  // ========== MESSAGE HANDLER ==========

  private async handleMessage(ws: WebSocket, msg: ClientMessage): Promise<void> {
    switch (msg.type) {
      case 'create-room': return this.handleCreateRoom(ws, msg);
      case 'create-bot-game': return this.handleCreateBotGame(ws, msg);
      case 'join-room': return this.handleJoinRoom(ws, msg);
      case 'reconnect-to-room': return this.handleReconnect(ws, msg);
      case 'leave-room': return this.handleLeaveRoom(ws);
      case 'start-game': return this.handleStartGame(ws, msg);
      case 'game-action': return this.handleGameAction(ws, msg);
      case 'kick-player': return this.handleKickPlayer(ws, msg);
      case 'update-room-settings': return this.handleUpdateSettings(ws, msg);
      case 'toggle-ready': return this.handleToggleReady(ws, msg);
      case 'request-team-switch': return this.handleRequestTeamSwitch(ws, msg);
      case 'respond-team-switch': return this.handleRespondTeamSwitch(ws, msg);
      case 'continue-series': return this.handleContinueSeries(ws, msg);
      case 'end-series': return this.handleEndSeries(ws, msg);
      case 'add-bot': return this.handleAddBot(ws, msg);
      case 'remove-bot': return this.handleRemoveBot(ws, msg);
      case 'send-emote': return this.handleSendEmote(ws, msg);
      case 'send-quick-message': return this.handleSendQuickMessage(ws, msg);
    }
  }

  // ========== EVENT HANDLERS ==========

  private async handleCreateRoom(ws: WebSocket, msg: ClientMessage & { type: 'create-room' }): Promise<void> {
    const { roomName, playerName, maxPlayers, teamCount, turnTimeLimit, sequencesToWin, sequenceLength, seriesLength } = msg.data;

    // Get room code from tags
    const tags = this.state.getTags(ws);
    const roomCode = tags[1] || '';

    const host = createPlayer(playerName, true);
    this.room = createRoomData(
      roomCode, roomName, host, maxPlayers, teamCount,
      turnTimeLimit ?? 0, sequencesToWin, sequenceLength, seriesLength
    );

    this.wsToPlayer.set(ws, host.id);
    this.playerToWs.set(host.id, ws);
    ws.serializeAttachment({ playerId: host.id });

    // Store token -> roomCode in KV
    await this.env.PLAYER_TOKENS.put(
      host.token,
      JSON.stringify({ roomCode, playerId: host.id }),
      { expirationTtl: 86400 } // 24 hours
    );

    this.sendResponse(ws, msg.id, {
      success: true,
      roomCode,
      playerId: host.id,
      token: host.token,
    });

    this.sendTo(ws, { type: 'room-updated', data: toRoomInfo(this.room) });
  }

  private async handleCreateBotGame(ws: WebSocket, msg: ClientMessage & { type: 'create-bot-game' }): Promise<void> {
    const { playerName, difficulty, sequenceLength } = msg.data;
    const tags = this.state.getTags(ws);
    const roomCode = tags[1] || '';

    const host = createPlayer(playerName, true);
    this.room = createRoomData(
      roomCode, `${playerName} vs Bot`, host, 2, 2,
      0, undefined, sequenceLength
    );

    this.wsToPlayer.set(ws, host.id);
    this.playerToWs.set(host.id, ws);
    ws.serializeAttachment({ playerId: host.id });

    await this.env.PLAYER_TOKENS.put(
      host.token,
      JSON.stringify({ roomCode, playerId: host.id }),
      { expirationTtl: 86400 }
    );

    const botResult = addBotToRoom(this.room, difficulty);
    if ('error' in botResult) {
      this.sendResponse(ws, msg.id, { success: false, error: botResult.error });
      return;
    }

    // Auto-start
    const gameResult = startGameInRoom(this.room, host.id);
    if ('error' in gameResult) {
      this.sendResponse(ws, msg.id, { success: false, error: gameResult.error });
      return;
    }

    this.sendResponse(ws, msg.id, {
      success: true,
      roomCode,
      playerId: host.id,
      token: host.token,
    });

    if (this.room.gameState) {
      this.sendTo(ws, { type: 'game-started', data: toClientGameState(this.room.gameState, host.id) });
      await this.startTurnTimer();
      await this.scheduleBotTurnIfNeeded();
    }
  }

  private async handleJoinRoom(ws: WebSocket, msg: ClientMessage & { type: 'join-room' }): Promise<void> {
    if (!this.room) {
      this.sendResponse(ws, msg.id, { success: false, error: 'Room not found' });
      return;
    }

    const result = addPlayerToRoom(this.room, msg.data.playerName, msg.data.token);
    if ('error' in result) {
      this.sendResponse(ws, msg.id, { success: false, error: result.error });
      return;
    }

    const player = result;
    this.wsToPlayer.set(ws, player.id);
    this.playerToWs.set(player.id, ws);
    ws.serializeAttachment({ playerId: player.id });

    await this.env.PLAYER_TOKENS.put(
      player.token,
      JSON.stringify({ roomCode: this.room.code, playerId: player.id }),
      { expirationTtl: 86400 }
    );

    this.sendResponse(ws, msg.id, {
      success: true,
      roomInfo: toRoomInfo(this.room),
      playerId: player.id,
      token: player.token,
    });

    this.broadcastExcept(ws, { type: 'room-updated', data: toRoomInfo(this.room) });

    // Notify about active modes
    const settings = {
      sequenceLength: this.room.sequenceLength,
      turnTimeLimit: this.room.turnTimeLimit,
      seriesLength: this.room.seriesLength,
    };
    const modes = getActiveModes(settings);
    if (modes.length > 0) {
      const host = this.room.players.find(p => p.id === this.room!.hostId);
      this.sendTo(ws, {
        type: 'game-mode-changed',
        data: { modes, changedBy: host?.name || 'Host', settings },
      });
    }
  }

  private async handleReconnect(ws: WebSocket, msg: ClientMessage & { type: 'reconnect-to-room' }): Promise<void> {
    if (!this.room) {
      this.sendResponse(ws, msg.id, { success: false, error: 'Room not found or expired' });
      return;
    }

    const { token } = msg.data;
    const player = this.room.players.find(p => p.token === token);
    if (!player) {
      this.sendResponse(ws, msg.id, { success: false, error: 'Invalid token' });
      return;
    }

    // Clean up old WebSocket for this player (prevents stale close from marking player disconnected)
    const oldWs = this.playerToWs.get(player.id);
    if (oldWs && oldWs !== ws) {
      this.wsToPlayer.delete(oldWs);
      try { oldWs.close(1000, 'Superseded by reconnection'); } catch {}
    }

    player.connected = true;
    this.wsToPlayer.set(ws, player.id);
    this.playerToWs.set(player.id, ws);
    ws.serializeAttachment({ playerId: player.id });

    // Cancel cleanup timer
    await this.clearTimer('cleanup');

    const roomInfo = toRoomInfo(this.room);
    const gameState = this.room.gameState
      ? toClientGameState(this.room.gameState, player.id)
      : undefined;

    this.sendResponse(ws, msg.id, {
      success: true,
      roomInfo,
      gameState,
      playerId: player.id,
    });

    this.broadcastExcept(ws, { type: 'player-reconnected', data: player.id });
  }

  private async handleLeaveRoom(ws: WebSocket): Promise<void> {
    const playerId = this.wsToPlayer.get(ws);
    if (!playerId || !this.room) return;

    const isHost = this.room.hostId === playerId;
    const isInGame = this.room.phase === 'in-game';

    if (isHost && isInGame) {
      await this.clearAllTimers();
      this.broadcast({ type: 'room-closed', data: 'Host ended the game' });
      this.closeAllConnections();
      await this.destroyRoom();
      return;
    }

    removePlayerFromRoom(this.room, playerId);
    this.wsToPlayer.delete(ws);
    this.playerToWs.delete(playerId);

    if (this.room.players.length === 0) {
      await this.destroyRoom();
      return;
    }

    this.broadcast({ type: 'room-updated', data: toRoomInfo(this.room) });
  }

  private async handleStartGame(ws: WebSocket, msg: ClientMessage & { type: 'start-game' }): Promise<void> {
    const playerId = this.wsToPlayer.get(ws);
    if (!playerId || !this.room) {
      this.sendResponse(ws, msg.id, { success: false, error: 'Not in a room' });
      return;
    }

    const result = startGameInRoom(this.room, playerId);
    if ('error' in result) {
      this.sendResponse(ws, msg.id, { success: false, error: result.error });
      return;
    }

    this.sendResponse(ws, msg.id, { success: true });

    if (this.room.gameState) {
      // Send cut results to all
      this.broadcast({
        type: 'cut-result',
        data: {
          cutCards: this.room.gameState.cutCards,
          dealerIndex: this.room.gameState.dealerIndex,
        },
      });

      // Send individual game states
      for (const player of this.room.players) {
        const playerWs = this.playerToWs.get(player.id);
        if (playerWs) {
          this.sendTo(playerWs, {
            type: 'game-started',
            data: toClientGameState(this.room.gameState, player.id),
          });
        }
      }

      await this.startTurnTimer();
      await this.scheduleBotTurnIfNeeded();
    }
  }

  private async handleGameAction(ws: WebSocket, msg: ClientMessage & { type: 'game-action' }): Promise<void> {
    const playerId = this.wsToPlayer.get(ws);
    if (!playerId || !this.room || !this.room.gameState) {
      this.sendResponse(ws, msg.id, { success: false, error: 'Game not in progress' });
      return;
    }

    const previousPlayerIndex = this.room.gameState.currentPlayerIndex;
    const result = applyMove(this.room.gameState, playerId, msg.data);

    this.sendResponse(ws, msg.id, result);

    if (result.success) {
      const turnChanged = this.room.gameState.currentPlayerIndex !== previousPlayerIndex;

      if (turnChanged && !result.gameOver) {
        this.room.gameState.turnStartedAt = this.room.gameState.turnTimeLimit > 0 ? Date.now() : null;
        await this.startTurnTimer();
      }

      this.broadcastGameState();

      if (result.gameOver && result.winnerTeamIndex !== undefined) {
        await this.clearAllTimers();
        this.broadcast({
          type: 'game-over',
          data: { winnerTeamIndex: result.winnerTeamIndex, stalemate: result.stalemate },
        });
      } else {
        await this.scheduleBotTurnIfNeeded();
      }
    }
  }

  private async handleKickPlayer(ws: WebSocket, msg: ClientMessage & { type: 'kick-player' }): Promise<void> {
    const playerId = this.wsToPlayer.get(ws);
    if (!playerId || !this.room) return;

    const result = kickPlayerFromRoom(this.room, playerId, msg.data.playerId);
    if (result.error) {
      this.sendTo(ws, { type: 'error', data: { message: result.error } });
      return;
    }

    // Close kicked player's WebSocket
    const kickedWs = this.playerToWs.get(msg.data.playerId);
    if (kickedWs) {
      this.sendTo(kickedWs, { type: 'room-closed', data: 'You were kicked from the room' });
      kickedWs.close(1000, 'Kicked');
      this.wsToPlayer.delete(kickedWs);
      this.playerToWs.delete(msg.data.playerId);
    }

    this.broadcast({ type: 'room-updated', data: toRoomInfo(this.room) });
    this.broadcast({ type: 'player-left', data: msg.data.playerId });
  }

  private async handleUpdateSettings(ws: WebSocket, msg: ClientMessage & { type: 'update-room-settings' }): Promise<void> {
    const playerId = this.wsToPlayer.get(ws);
    if (!playerId || !this.room) {
      this.sendResponse(ws, msg.id, { success: false, error: 'Not in a room' });
      return;
    }

    const oldSettings = {
      sequenceLength: this.room.sequenceLength,
      turnTimeLimit: this.room.turnTimeLimit,
      seriesLength: this.room.seriesLength,
    };

    const result = updateRoomSettings(this.room, playerId, msg.data);
    if (result.error) {
      this.sendResponse(ws, msg.id, { success: false, error: result.error });
      return;
    }

    this.sendResponse(ws, msg.id, { success: true });
    this.broadcast({ type: 'room-updated', data: toRoomInfo(this.room) });

    // Check mode changes
    const newSettings = {
      sequenceLength: this.room.sequenceLength,
      turnTimeLimit: this.room.turnTimeLimit,
      seriesLength: this.room.seriesLength,
    };
    const modes = getActiveModes(newSettings);
    const oldModes = getActiveModes(oldSettings);

    if (modes.length > 0 && JSON.stringify(modes) !== JSON.stringify(oldModes)) {
      const host = this.room.players.find(p => p.id === this.room!.hostId);
      for (const player of this.room.players) {
        if (player.id !== this.room.hostId) {
          const playerWs = this.playerToWs.get(player.id);
          if (playerWs) {
            this.sendTo(playerWs, {
              type: 'game-mode-changed',
              data: { modes, changedBy: host?.name || 'Host', settings: newSettings },
            });
          }
        }
      }
    }
  }

  private async handleToggleReady(ws: WebSocket, msg: ClientMessage & { type: 'toggle-ready' }): Promise<void> {
    const playerId = this.wsToPlayer.get(ws);
    if (!playerId || !this.room) {
      this.sendResponse(ws, msg.id, { success: false, error: 'Not in a room' });
      return;
    }

    const result = togglePlayerReady(this.room, playerId);
    if (result.error) {
      this.sendResponse(ws, msg.id, { success: false, error: result.error });
      return;
    }

    this.sendResponse(ws, msg.id, { success: true });
    this.broadcast({ type: 'room-updated', data: toRoomInfo(this.room) });
  }

  private async handleRequestTeamSwitch(ws: WebSocket, msg: ClientMessage & { type: 'request-team-switch' }): Promise<void> {
    const playerId = this.wsToPlayer.get(ws);
    if (!playerId || !this.room) {
      this.sendResponse(ws, msg.id, { success: false, error: 'Not in a room' });
      return;
    }

    const player = this.room.players.find(p => p.id === playerId);
    if (!player) {
      this.sendResponse(ws, msg.id, { success: false, error: 'Player not found' });
      return;
    }

    // Host can switch directly
    if (this.room.hostId === playerId) {
      const result = switchPlayerTeam(this.room, playerId, msg.data.toTeamIndex);
      if (result.error) {
        this.sendResponse(ws, msg.id, { success: false, error: result.error });
        return;
      }
      this.sendResponse(ws, msg.id, { success: true });
      this.broadcast({ type: 'room-updated', data: toRoomInfo(this.room) });
      return;
    }

    // Create pending request
    const request: TeamSwitchRequest = {
      playerId,
      playerName: player.name,
      fromTeamIndex: player.teamIndex,
      toTeamIndex: msg.data.toTeamIndex,
    };
    this.pendingTeamSwitches.set(playerId, request);

    this.sendResponse(ws, msg.id, { success: true });

    // Send to host
    const hostWs = this.playerToWs.get(this.room.hostId);
    if (hostWs) {
      this.sendTo(hostWs, { type: 'team-switch-request', data: request });
    }
  }

  private async handleRespondTeamSwitch(ws: WebSocket, msg: ClientMessage & { type: 'respond-team-switch' }): Promise<void> {
    const playerId = this.wsToPlayer.get(ws);
    if (!playerId || !this.room) {
      this.sendResponse(ws, msg.id, { success: false, error: 'Not in a room' });
      return;
    }

    if (this.room.hostId !== playerId) {
      this.sendResponse(ws, msg.id, { success: false, error: 'Only the host can approve team switches' });
      return;
    }

    const request = this.pendingTeamSwitches.get(msg.data.playerId);
    if (!request) {
      this.sendResponse(ws, msg.id, { success: false, error: 'No pending switch request' });
      return;
    }

    this.pendingTeamSwitches.delete(msg.data.playerId);

    if (msg.data.approved) {
      const result = switchPlayerTeam(this.room, msg.data.playerId, request.toTeamIndex);
      if (result.error) {
        this.sendResponse(ws, msg.id, { success: false, error: result.error });
        return;
      }
      this.broadcast({ type: 'room-updated', data: toRoomInfo(this.room) });
    }

    this.sendResponse(ws, msg.id, { success: true });

    const requesterWs = this.playerToWs.get(msg.data.playerId);
    if (requesterWs) {
      this.sendTo(requesterWs, {
        type: 'team-switch-response',
        data: { playerId: msg.data.playerId, approved: msg.data.approved, playerName: request.playerName },
      });
    }
  }

  private async handleContinueSeries(ws: WebSocket, msg: ClientMessage & { type: 'continue-series' }): Promise<void> {
    const playerId = this.wsToPlayer.get(ws);
    if (!playerId || !this.room) {
      this.sendResponse(ws, msg.id, { success: false, error: 'Not in a room' });
      return;
    }

    const result = continueSeriesInRoom(this.room, playerId);

    if ('error' in result) {
      if (result.error === 'Series over') {
        this.sendResponse(ws, msg.id, { success: true });
        this.broadcast({ type: 'room-updated', data: toRoomInfo(this.room) });
        return;
      }
      this.sendResponse(ws, msg.id, { success: false, error: result.error });
      return;
    }

    this.sendResponse(ws, msg.id, { success: true });

    // Send new game state to each player
    for (const player of this.room.players) {
      const playerWs = this.playerToWs.get(player.id);
      if (playerWs) {
        this.sendTo(playerWs, {
          type: 'game-state-updated',
          data: toClientGameState(result, player.id),
        });
      }
    }

    if (result.turnTimeLimit > 0) {
      await this.startTurnTimer();
    }
    await this.scheduleBotTurnIfNeeded();
  }

  private async handleEndSeries(ws: WebSocket, msg: ClientMessage & { type: 'end-series' }): Promise<void> {
    const playerId = this.wsToPlayer.get(ws);
    if (!playerId || !this.room) {
      this.sendResponse(ws, msg.id, { success: false, error: 'Not in a room' });
      return;
    }

    const result = endSeriesInRoom(this.room, playerId);
    if (result.error) {
      this.sendResponse(ws, msg.id, { success: false, error: result.error });
      return;
    }

    this.sendResponse(ws, msg.id, { success: true });
    await this.clearAllTimers();
    this.broadcast({ type: 'room-updated', data: toRoomInfo(this.room) });
  }

  private async handleAddBot(ws: WebSocket, msg: ClientMessage & { type: 'add-bot' }): Promise<void> {
    const playerId = this.wsToPlayer.get(ws);
    if (!playerId || !this.room) {
      this.sendResponse(ws, msg.id, { success: false, error: 'Not in a room' });
      return;
    }

    if (this.room.hostId !== playerId) {
      this.sendResponse(ws, msg.id, { success: false, error: 'Only the host can add bots' });
      return;
    }

    const result = addBotToRoom(this.room, msg.data.difficulty);
    if ('error' in result) {
      this.sendResponse(ws, msg.id, { success: false, error: result.error });
      return;
    }

    this.sendResponse(ws, msg.id, { success: true });
    this.broadcast({ type: 'room-updated', data: toRoomInfo(this.room) });
  }

  private async handleRemoveBot(ws: WebSocket, msg: ClientMessage & { type: 'remove-bot' }): Promise<void> {
    const playerId = this.wsToPlayer.get(ws);
    if (!playerId || !this.room) {
      this.sendResponse(ws, msg.id, { success: false, error: 'Not in a room' });
      return;
    }

    if (this.room.hostId !== playerId) {
      this.sendResponse(ws, msg.id, { success: false, error: 'Only the host can remove bots' });
      return;
    }

    const result = removeBotFromRoom(this.room, msg.data.botPlayerId);
    if (result.error) {
      this.sendResponse(ws, msg.id, { success: false, error: result.error });
      return;
    }

    this.sendResponse(ws, msg.id, { success: true });
    this.broadcast({ type: 'room-updated', data: toRoomInfo(this.room) });
  }

  private handleSendEmote(ws: WebSocket, msg: ClientMessage & { type: 'send-emote' }): void {
    const playerId = this.wsToPlayer.get(ws);
    if (!playerId || !this.room) return;

    const player = this.room.players.find(p => p.id === playerId);
    if (!player) return;

    this.broadcast({
      type: 'emote-received',
      data: { playerId, playerName: player.name, emote: msg.data.emote },
    });
  }

  private handleSendQuickMessage(ws: WebSocket, msg: ClientMessage & { type: 'send-quick-message' }): void {
    const playerId = this.wsToPlayer.get(ws);
    if (!playerId || !this.room) return;

    const player = this.room.players.find(p => p.id === playerId);
    if (!player) return;

    this.broadcast({
      type: 'quick-message-received',
      data: { playerId, playerName: player.name, message: msg.data.message },
    });
  }

  // ========== TURN TIMER ==========

  private async startTurnTimer(): Promise<void> {
    if (!this.room?.gameState || this.room.gameState.turnTimeLimit === 0) return;
    await this.clearTimer('turn-timeout');
    await this.scheduleTimer('turn-timeout', this.room.gameState.turnTimeLimit * 1000);
  }

  private handleTurnTimeout(): void {
    if (!this.room?.gameState || this.room.gameState.phase !== 'playing') return;

    const gameState = this.room.gameState;
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const playerName = currentPlayer.name;
    const playerIndex = gameState.currentPlayerIndex;

    // Skip turn
    gameState.deadCardReplacedThisTurn = false;
    gameState.pendingDraw = false;
    gameState.lastRemovedCell = null;
    gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
    gameState.turnStartedAt = gameState.turnTimeLimit > 0 ? Date.now() : null;

    this.broadcast({ type: 'turn-timeout', data: { playerIndex, playerName } });
    this.broadcastGameState();

    // Check if next player is disconnected
    const nextPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!nextPlayer.connected && !nextPlayer.isBot) {
      // Will schedule disconnect-skip in alarm
      this.timers.push({ type: 'disconnect-skip', fireAt: Date.now() + 3000 });
      this.timers.sort((a, b) => a.fireAt - b.fireAt);
    } else {
      // Start timer for next player
      if (gameState.turnTimeLimit > 0) {
        this.timers.push({ type: 'turn-timeout', fireAt: Date.now() + gameState.turnTimeLimit * 1000 });
        this.timers.sort((a, b) => a.fireAt - b.fireAt);
      }
      // Schedule bot turn
      this.scheduleBotTurnSync();
    }
  }

  // ========== BOT LOGIC ==========

  private async scheduleBotTurnIfNeeded(): Promise<void> {
    if (!this.room?.gameState || this.room.gameState.phase !== 'playing') return;

    const currentPlayer = this.room.gameState.players[this.room.gameState.currentPlayerIndex];
    if (!currentPlayer.isBot) return;

    const difficulty = currentPlayer.botDifficulty || 'easy';
    const delay = getBotDelay(difficulty);

    await this.clearTimer('bot-turn');
    await this.scheduleTimer('bot-turn', delay);
  }

  private scheduleBotTurnSync(): void {
    if (!this.room?.gameState || this.room.gameState.phase !== 'playing') return;

    const currentPlayer = this.room.gameState.players[this.room.gameState.currentPlayerIndex];
    if (!currentPlayer.isBot) return;

    const difficulty = currentPlayer.botDifficulty || 'easy';
    const delay = getBotDelay(difficulty);

    this.timers = this.timers.filter(t => t.type !== 'bot-turn');
    this.timers.push({ type: 'bot-turn', fireAt: Date.now() + delay });
    this.timers.sort((a, b) => a.fireAt - b.fireAt);
  }

  private executeBotTurn(): void {
    if (!this.room?.gameState || this.room.gameState.phase !== 'playing') return;

    const gameState = this.room.gameState;
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!currentPlayer.isBot) return;

    const difficulty = currentPlayer.botDifficulty || 'easy';
    const action = decideBotAction(gameState, currentPlayer, difficulty);

    if (action.type === 'replace-dead') {
      applyMove(gameState, currentPlayer.id, action);
      this.broadcastGameState();
      // Schedule next bot action
      this.timers.push({ type: 'bot-turn', fireAt: Date.now() + 400 });
      this.timers.sort((a, b) => a.fireAt - b.fireAt);
      return;
    }

    if (action.type === 'draw') {
      const previousPlayerIndex = gameState.currentPlayerIndex;
      const drawResult = applyMove(gameState, currentPlayer.id, action);

      if (drawResult.success) {
        const turnChanged = gameState.currentPlayerIndex !== previousPlayerIndex;
        if (turnChanged && !drawResult.gameOver) {
          gameState.turnStartedAt = gameState.turnTimeLimit > 0 ? Date.now() : null;
          if (gameState.turnTimeLimit > 0) {
            this.timers = this.timers.filter(t => t.type !== 'turn-timeout');
            this.timers.push({ type: 'turn-timeout', fireAt: Date.now() + gameState.turnTimeLimit * 1000 });
            this.timers.sort((a, b) => a.fireAt - b.fireAt);
          }
        }

        this.broadcastGameState();

        if (drawResult.gameOver && drawResult.winnerTeamIndex !== undefined) {
          this.timers = [];
          this.broadcast({
            type: 'game-over',
            data: { winnerTeamIndex: drawResult.winnerTeamIndex, stalemate: drawResult.stalemate },
          });
        } else {
          this.scheduleBotTurnSync();
        }
      }
      return;
    }

    // Play action
    const previousPlayerIndex = gameState.currentPlayerIndex;
    const playResult = applyMove(gameState, currentPlayer.id, action);

    if (playResult.success) {
      this.broadcastGameState();

      if (playResult.gameOver && playResult.winnerTeamIndex !== undefined) {
        this.timers = [];
        this.broadcast({
          type: 'game-over',
          data: { winnerTeamIndex: playResult.winnerTeamIndex, stalemate: playResult.stalemate },
        });
        return;
      }

      // Draw after a short delay
      this.timers.push({ type: 'bot-turn', fireAt: Date.now() + 400 });
      this.timers.sort((a, b) => a.fireAt - b.fireAt);
    }
  }

  // ========== MESSAGING HELPERS ==========

  private sendTo(ws: WebSocket, msg: { type: string; data?: unknown }): void {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      // WebSocket might be closed
    }
  }

  private sendResponse(ws: WebSocket, id: string, data: Record<string, unknown>): void {
    this.sendTo(ws, { type: 'response', id, data });
  }

  private broadcast(msg: { type: string; data?: unknown }): void {
    const sockets = this.state.getWebSockets();
    const json = JSON.stringify(msg);
    for (const ws of sockets) {
      try {
        ws.send(json);
      } catch {
        // Ignore closed sockets
      }
    }
  }

  private broadcastExcept(exclude: WebSocket, msg: { type: string; data?: unknown }): void {
    const sockets = this.state.getWebSockets();
    const json = JSON.stringify(msg);
    for (const ws of sockets) {
      if (ws === exclude) continue;
      try {
        ws.send(json);
      } catch {
        // Ignore closed sockets
      }
    }
  }

  private broadcastGameState(): void {
    if (!this.room?.gameState) return;

    for (const player of this.room.players) {
      const playerWs = this.playerToWs.get(player.id);
      if (playerWs) {
        this.sendTo(playerWs, {
          type: 'game-state-updated',
          data: toClientGameState(this.room.gameState, player.id),
        });
      }
    }
  }

  // ========== CLEANUP ==========

  private closeAllConnections(): void {
    const sockets = this.state.getWebSockets();
    for (const ws of sockets) {
      try {
        ws.close(1000, 'Room closed');
      } catch {
        // Ignore
      }
    }
    this.wsToPlayer.clear();
    this.playerToWs.clear();
  }

  private async destroyRoom(): Promise<void> {
    // Clean up KV tokens
    if (this.room) {
      for (const player of this.room.players) {
        try {
          await this.env.PLAYER_TOKENS.delete(player.token);
        } catch {
          // Ignore
        }
      }
    }

    this.room = null;
    this.timers = [];
    await this.state.storage.deleteAll();
  }

  private async cleanupRoom(): Promise<void> {
    if (!this.room) return;

    const hasConnected = this.room.players.some(p => p.connected && !p.isBot);
    if (!hasConnected) {
      this.closeAllConnections();
      await this.destroyRoom();
    }
  }
}
