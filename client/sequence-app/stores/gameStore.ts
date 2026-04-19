import { create } from 'zustand';
import { socket } from '@/services/socket';
import { api } from '@/services/api';
import type {
  RoomInfo, ClientGameState, ConnectionPhase, GameAction,
  CreateRoomPayload, CreateBotGamePayload, UpdateRoomSettingsPayload,
  RoomSession, PublicPlayer, CutCard, ConnectionStatus,
  connectionIdle, connectionConnecting, connectionAttached,
} from '@/types/game';
import { WS_BASE_URL, DEEP_LINK_SCHEME } from '@/constants/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ROOM_SESSION_KEY = 'sequence_room_session';

type CelebrationState = {
  teamIndex: number;
  teamColor: string;
  sequences: number;
  pointsAwarded: number;
  totalScore: number;
} | null;

interface GameStoreState {
  // Room
  roomInfo: RoomInfo | null;
  roomCode: string | null;
  playerId: string | null;
  roomToken: string | null;

  // Game
  gameState: ClientGameState | null;
  selectedCard: string | null;
  highlightedCells: Set<string>;
  celebrationState: CelebrationState;
  cutCards: CutCard[] | null;
  winnerInfo: { teamIndex: number; teamColor: string } | null;

  // Connection
  connectionStatus: ConnectionStatus;
  wsConnected: boolean;

  // Pending invite
  pendingRoomCode: string | null;

  // Actions
  createRoom: (payload: CreateRoomPayload, authToken: string) => Promise<void>;
  createBotGame: (payload: CreateBotGamePayload, authToken: string) => Promise<void>;
  joinRoom: (code: string, playerName: string, authToken: string) => Promise<void>;
  leaveRoom: () => void;
  reconnectToRoom: (authToken: string) => Promise<void>;
  toggleReady: () => void;
  startGame: () => void;
  sendGameAction: (action: GameAction) => void;
  addBot: (difficulty: string) => void;
  kickPlayer: (playerId: string) => void;
  updateRoomSettings: (settings: UpdateRoomSettingsPayload) => void;
  requestTeamSwitch: (targetTeamIndex: number) => void;
  respondToTeamSwitch: (approve: boolean) => void;
  selectCard: (card: string | null) => void;
  setHighlightedCells: (cells: Set<string>) => void;
  setPendingRoomCode: (code: string | null) => void;
  clearActiveRoom: () => void;
  handleWebSocketMessage: (type: string, data: any) => void;

  // Internal
  _saveRoomSession: (code: string, token: string, playerId: string) => Promise<void>;
  _loadRoomSession: () => Promise<RoomSession | null>;
  _clearRoomSession: () => Promise<void>;
  _connectWebSocket: (path: string, authToken?: string) => Promise<void>;
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  // Room
  roomInfo: null,
  roomCode: null,
  playerId: null,
  roomToken: null,

  // Game
  gameState: null,
  selectedCard: null,
  highlightedCells: new Set(),
  celebrationState: null,
  cutCards: null,
  winnerInfo: null,

  // Connection
  connectionStatus: { phase: 'idle', message: null, attempt: 0, canRetry: false },
  wsConnected: false,

  // Pending invite
  pendingRoomCode: null,

  createRoom: async (payload, authToken) => {
    set({ connectionStatus: { phase: 'connecting', message: 'Creating room...', attempt: 0, canRetry: false } });
    try {
      const result = await api.request<{ success: boolean; roomCode?: string; playerId?: string; token?: string }>('/api/rooms', 'POST', authToken, payload);
      if (result.roomCode && result.playerId && result.token) {
        set({ roomCode: result.roomCode, playerId: result.playerId, roomToken: result.token });
        await get()._saveRoomSession(result.roomCode, result.token, result.playerId);
        await get()._connectWebSocket(`/ws/room/${result.roomCode}?token=${result.token}`, authToken);
      }
    } catch (error: any) {
      set({ connectionStatus: { phase: 'terminalFailure', message: error.message, attempt: 0, canRetry: true } });
    }
  },

  createBotGame: async (payload, authToken) => {
    set({ connectionStatus: { phase: 'connecting', message: 'Starting practice game...', attempt: 0, canRetry: false } });
    try {
      const result = await api.request<{ success: boolean; roomCode?: string; playerId?: string; token?: string }>('/api/rooms/bot', 'POST', authToken, payload);
      if (result.roomCode && result.playerId && result.token) {
        set({ roomCode: result.roomCode, playerId: result.playerId, roomToken: result.token });
        await get()._saveRoomSession(result.roomCode, result.token, result.playerId);
        await get()._connectWebSocket(`/ws/room/${result.roomCode}?token=${result.token}`, authToken);
      }
    } catch (error: any) {
      set({ connectionStatus: { phase: 'terminalFailure', message: error.message, attempt: 0, canRetry: true } });
    }
  },

  joinRoom: async (code, playerName, authToken) => {
    set({ connectionStatus: { phase: 'connecting', message: 'Joining room...', attempt: 0, canRetry: false } });
    try {
      const result = await api.request<{ success: boolean; roomInfo?: RoomInfo; playerId?: string; token?: string }>('/api/rooms/join', 'POST', authToken, { roomCode: code, playerName });
      if (result.roomInfo && result.playerId && result.token) {
        set({ roomInfo: result.roomInfo, roomCode: code, playerId: result.playerId, roomToken: result.token });
        await get()._saveRoomSession(code, result.token, result.playerId);
        await get()._connectWebSocket(`/ws/room/${code}?token=${result.token}`, authToken);
      }
    } catch (error: any) {
      set({ connectionStatus: { phase: 'terminalFailure', message: error.message, attempt: 0, canRetry: true } });
    }
  },

  leaveRoom: () => {
    socket.disconnect();
    set({
      roomInfo: null, roomCode: null, playerId: null, roomToken: null,
      gameState: null, selectedCard: null, highlightedCells: new Set(),
      celebrationState: null, cutCards: null, winnerInfo: null,
      connectionStatus: { phase: 'idle', message: null, attempt: 0, canRetry: false },
      wsConnected: false,
    });
    get()._clearRoomSession();
  },

  reconnectToRoom: async (authToken) => {
    const session = await get()._loadRoomSession();
    if (!session) {
      set({ connectionStatus: { phase: 'terminalFailure', message: 'No saved session', attempt: 0, canRetry: false } });
      return;
    }
    set({ connectionStatus: { phase: 'recovering', message: 'Reconnecting...', attempt: 0, canRetry: false } });
    try {
      const result = await api.request<{ success: boolean; roomInfo?: RoomInfo; gameState?: ClientGameState; playerId?: string; errorCode?: string }>(`/api/rooms/${session.roomCode}/reconnect`, 'POST', authToken, { token: session.token });
      if (result.success && result.roomInfo) {
        set({ roomInfo: result.roomInfo, roomCode: session.roomCode, playerId: result.playerId, gameState: result.gameState ?? null });
        await get()._connectWebSocket(`/ws/room/${session.roomCode}?token=${session.token}`, authToken);
      } else {
        await get()._clearRoomSession();
        set({ connectionStatus: { phase: 'terminalFailure', message: result.errorCode ?? 'Room not found', attempt: 0, canRetry: false } });
      }
    } catch (error: any) {
      set({ connectionStatus: { phase: 'offline', message: error.message, attempt: 0, canRetry: true } });
    }
  },

  toggleReady: () => {
    socket.send('toggle-ready');
  },

  startGame: () => {
    socket.send('start-game');
  },

  sendGameAction: (action: GameAction) => {
    socket.send('game-action', action);
  },

  addBot: (difficulty: string) => {
    socket.send('add-bot', { difficulty });
  },

  kickPlayer: (playerId: string) => {
    socket.send('kick-player', { playerId });
  },

  updateRoomSettings: (settings: UpdateRoomSettingsPayload) => {
    socket.send('update-settings', settings);
  },

  requestTeamSwitch: (targetTeamIndex: number) => {
    socket.send('team-switch-request', { targetTeamIndex });
  },

  respondToTeamSwitch: (approve: boolean) => {
    socket.send('team-switch-response', { approve });
  },

  selectCard: (card: string | null) => {
    set({ selectedCard: card });
  },

  setHighlightedCells: (cells: Set<string>) => {
    set({ highlightedCells: cells });
  },

  setPendingRoomCode: (code: string | null) => {
    set({ pendingRoomCode: code });
  },

  clearActiveRoom: () => {
    socket.disconnect();
    set({
      roomInfo: null, roomCode: null, playerId: null, roomToken: null,
      gameState: null, selectedCard: null, highlightedCells: new Set(),
      celebrationState: null, cutCards: null, winnerInfo: null,
      connectionStatus: { phase: 'idle', message: null, attempt: 0, canRetry: false },
      wsConnected: false,
    });
    get()._clearRoomSession();
  },

  handleWebSocketMessage: (type: string, data: any) => {
    const state = get();
    switch (type) {
      case 'room-state':
      case 'room-info':
        set({ roomInfo: data as RoomInfo });
        break;

      case 'game-state':
        set({ gameState: data as ClientGameState });
        break;

      case 'player-joined':
      case 'player-left':
      case 'player-ready':
      case 'player-unready':
      case 'room-settings-updated':
        // These come as room-state updates
        if (data) set({ roomInfo: data as RoomInfo });
        break;

      case 'game-action-result': {
        const result = data as { success: boolean; error?: string; scoring?: any; winnerTeamIndex?: number; gameOver?: boolean };
        if (!result.success && result.error) {
          // Could show a toast/alert
          console.warn('Game action error:', result.error);
        }
        break;
      }

      case 'celebration':
        set({
          celebrationState: {
            teamIndex: data.teamIndex,
            teamColor: data.teamColor,
            sequences: data.sequenceCount ?? 1,
            pointsAwarded: data.pointsAwarded ?? 0,
            totalScore: data.totalScore ?? 0,
          },
        });
        // Auto-clear celebration after 3 seconds
        setTimeout(() => set({ celebrationState: null }), 3000);
        break;

      case 'winner':
        set({
          winnerInfo: { teamIndex: data.teamIndex, teamColor: data.teamColor },
        });
        break;

      case 'cut-cards':
        set({ cutCards: data.cards ?? data });
        break;

      case 'series-update':
        if (state.roomInfo) {
          set({
            roomInfo: { ...state.roomInfo, seriesState: data },
          });
        }
        break;

      case 'team-switch-request':
        // Could show modal to player
        break;

      case 'team-switch-response':
        // Handle response
        break;

      case 'error':
        console.error('WebSocket error:', data.message ?? data);
        break;

      default:
        // Unknown message type — ignore
        break;
    }
  },

  _saveRoomSession: async (code, token, playerId) => {
    await AsyncStorage.setItem(ROOM_SESSION_KEY, JSON.stringify({ roomCode: code, token, playerId }));
  },

  _loadRoomSession: async () => {
    try {
      const json = await AsyncStorage.getItem(ROOM_SESSION_KEY);
      return json ? JSON.parse(json) : null;
    } catch {
      return null;
    }
  },

  _clearRoomSession: async () => {
    await AsyncStorage.removeItem(ROOM_SESSION_KEY);
  },

  _connectWebSocket: async (path, authToken) => {
    try {
      await socket.connect(path, authToken);
      set({ wsConnected: true, connectionStatus: { phase: 'attached', message: null, attempt: 0, canRetry: false } });

      // Subscribe to messages
      socket.onMessage((type, data) => {
        get().handleWebSocketMessage(type, data);
      });

      socket.onStatus((status) => {
        if (status === 'disconnected') {
          set({ wsConnected: false, connectionStatus: { phase: 'offline', message: 'Connection lost', attempt: 0, canRetry: true } });
        } else if (status === 'reconnecting') {
          set({ connectionStatus: { phase: 'recovering', message: 'Reconnecting...', attempt: 0, canRetry: false } });
        } else if (status === 'connected') {
          set({ wsConnected: true, connectionStatus: { phase: 'attached', message: null, attempt: 0, canRetry: false } });
        }
      });
    } catch (error: any) {
      set({ connectionStatus: { phase: 'terminalFailure', message: error.message, attempt: 0, canRetry: true } });
    }
  },
}));