import { create } from 'zustand';
import { socket } from '@/services/socket';
import type {
  RoomInfo, ClientGameState, GameAction,
  CreateRoomPayload, CreateBotGamePayload, UpdateRoomSettingsPayload,
  RoomSession, CutCard, ConnectionStatus,
} from '@/types/game';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ROOM_SESSION_KEY = 'sequence_room_session';

let removeSocketMessageListener: (() => void) | null = null;
let removeSocketStatusListener: (() => void) | null = null;

const bindSocketListeners = (
  setState: (partial: Partial<GameStoreState>) => void,
  getState: () => GameStoreState,
) => {
  removeSocketMessageListener?.();
  removeSocketStatusListener?.();

  removeSocketMessageListener = socket.onMessage((type, data) => {
    getState().handleWebSocketMessage(type, data);
  });

  removeSocketStatusListener = socket.onStatus((status) => {
    if (status === 'disconnected') {
      setState({ wsConnected: false, connectionStatus: { phase: 'offline', message: 'Connection lost', attempt: 0, canRetry: true } });
    } else if (status === 'reconnecting') {
      setState({ connectionStatus: { phase: 'recovering', message: 'Reconnecting...', attempt: 0, canRetry: false } });
    } else if (status === 'connected') {
      setState({ wsConnected: true, connectionStatus: { phase: 'attached', message: null, attempt: 0, canRetry: false } });
    }
  });
};

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
      await get()._connectWebSocket('/ws/create', authToken);
      const result = await socket.request('create-room', payload) as { success: boolean; roomCode?: string; playerId?: string; token?: string };
      if (result.roomCode && result.playerId && result.token) {
        set({ roomCode: result.roomCode, playerId: result.playerId, roomToken: result.token });
        await get()._saveRoomSession(result.roomCode, result.token, result.playerId);
        socket.setSession({ roomCode: result.roomCode, token: result.token, playerId: result.playerId });
      }
    } catch (error: any) {
      socket.disconnect();
      set({ connectionStatus: { phase: 'terminalFailure', message: error.message, attempt: 0, canRetry: true } });
      throw error;
    }
  },

  createBotGame: async (payload, authToken) => {
    set({ connectionStatus: { phase: 'connecting', message: 'Starting practice game...', attempt: 0, canRetry: false } });
    try {
      await get()._connectWebSocket('/ws/create', authToken);
      const result = await socket.request('create-bot-game', payload) as { success: boolean; roomCode?: string; playerId?: string; token?: string };
      if (result.roomCode && result.playerId && result.token) {
        set({ roomCode: result.roomCode, playerId: result.playerId, roomToken: result.token });
        await get()._saveRoomSession(result.roomCode, result.token, result.playerId);
        socket.setSession({ roomCode: result.roomCode, token: result.token, playerId: result.playerId });
      }
    } catch (error: any) {
      socket.disconnect();
      set({ connectionStatus: { phase: 'terminalFailure', message: error.message, attempt: 0, canRetry: true } });
      throw error;
    }
  },

  joinRoom: async (code, playerName, authToken) => {
    set({ connectionStatus: { phase: 'connecting', message: 'Joining room...', attempt: 0, canRetry: false } });
    try {
      await get()._connectWebSocket(`/ws/room/${code}`, authToken);
      const result = await socket.request('join-room', { roomCode: code, playerName }) as { success: boolean; roomInfo?: RoomInfo; playerId?: string; token?: string };
      if (result.roomInfo && result.playerId && result.token) {
        set({ roomInfo: result.roomInfo, roomCode: code, playerId: result.playerId, roomToken: result.token });
        await get()._saveRoomSession(code, result.token, result.playerId);
        socket.setSession({ roomCode: code, token: result.token, playerId: result.playerId });
      }
    } catch (error: any) {
      socket.disconnect();
      set({ connectionStatus: { phase: 'terminalFailure', message: error.message, attempt: 0, canRetry: true } });
      throw error;
    }
  },

  leaveRoom: () => {
    socket.disconnect();
    removeSocketMessageListener?.();
    removeSocketStatusListener?.();
    removeSocketMessageListener = null;
    removeSocketStatusListener = null;
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
      await get()._connectWebSocket(`/ws/reconnect?token=${encodeURIComponent(session.token)}`, authToken);
      const result = await socket.request('reconnect-to-room', { roomCode: session.roomCode, token: session.token }) as { success: boolean; roomInfo?: RoomInfo; gameState?: ClientGameState; playerId?: string; errorCode?: string };
      if (result.success && result.roomInfo) {
        set({ roomInfo: result.roomInfo, roomCode: session.roomCode, playerId: result.playerId, roomToken: session.token, gameState: result.gameState ?? null });
        socket.setSession(session);
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
    socket.send('update-room-settings', settings);
  },

  requestTeamSwitch: (targetTeamIndex: number) => {
    socket.send('request-team-switch', { toTeamIndex: targetTeamIndex });
  },

  respondToTeamSwitch: (approve: boolean) => {
    socket.send('respond-team-switch', { approve });
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
    removeSocketMessageListener?.();
    removeSocketStatusListener?.();
    removeSocketMessageListener = null;
    removeSocketStatusListener = null;
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
      case 'room-updated':
      case 'room-state':
      case 'room-info':
        set({ roomInfo: data as RoomInfo });
        break;

      case 'game-started':
      case 'game-state-updated':
      case 'game-state':
        set({ gameState: data as ClientGameState });
        break;

      case 'cut-result':
      case 'cut-cards':
        set({ cutCards: data?.cutCards ?? data?.cards ?? data ?? null });
        break;

      case 'player-joined':
      case 'player-left':
      case 'player-ready':
      case 'player-unready':
      case 'room-settings-updated':
        if (data) set({ roomInfo: data as RoomInfo });
        break;

      case 'game-over':
        set({
          winnerInfo: data?.winnerTeamIndex !== undefined
            ? {
                teamIndex: data.winnerTeamIndex,
                teamColor: state.roomInfo?.players.find((player) => player.teamIndex === data.winnerTeamIndex)?.teamColor ?? 'blue',
              }
            : null,
        });
        break;

      case 'game-action-result': {
        const result = data as { success: boolean; error?: string; scoring?: any; winnerTeamIndex?: number; gameOver?: boolean };
        if (!result.success && result.error) {
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
        setTimeout(() => set({ celebrationState: null }), 3000);
        break;

      case 'winner':
        set({
          winnerInfo: { teamIndex: data.teamIndex, teamColor: data.teamColor },
        });
        break;

      case 'series-update':
        if (state.roomInfo) {
          set({
            roomInfo: { ...state.roomInfo, seriesState: data },
          });
        }
        break;

      case 'room-closed':
        set({ connectionStatus: { phase: 'terminalFailure', message: typeof data === 'string' ? data : 'Room closed', attempt: 0, canRetry: false } });
        break;

      case 'team-switch-request':
      case 'team-switch-response':
        break;

      case 'error':
        console.error('WebSocket error:', data?.message ?? data);
        break;

      default:
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
      bindSocketListeners(set, get);
      await socket.connect(path, authToken);
      set({ wsConnected: true, connectionStatus: { phase: 'attached', message: null, attempt: 0, canRetry: false } });
    } catch (error: any) {
      set({ connectionStatus: { phase: 'terminalFailure', message: error.message, attempt: 0, canRetry: true } });
      throw error;
    }
  },
}));