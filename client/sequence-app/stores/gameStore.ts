import { create } from 'zustand';
import { socket } from '@/services/socket';
import { useAuthStore } from '@/stores/authStore';
import type {
  RoomInfo, ClientGameState, GameAction,
  CreateRoomPayload, CreateBotGamePayload, UpdateRoomSettingsPayload,
  RoomSession, CutCard, ConnectionStatus, CardCode, TeamSwitchRequest,
  EmoteType, QuickMessageType, RealtimeNotice,
} from '@/types/game';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ROOM_SESSION_KEY = 'sequence_room_session';
let socketBindingsInitialized = false;
let noticeId = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectInFlight = false;

function formatEmote(emote?: EmoteType): string {
  switch (emote) {
    case 'thumbs-up': return '👍';
    case 'clap': return '👏';
    case 'fire': return '🔥';
    case 'thinking': return 'Thinking...';
    case 'laugh': return '😂';
    case 'cry': return '😢';
    case 'angry': return '😠';
    case 'heart': return '❤️';
    default: return 'sent an emote';
  }
}

function formatQuickMessage(message?: QuickMessageType): string {
  switch (message) {
    case 'good-game': return 'Good game';
    case 'nice-move': return 'Nice move';
    case 'oops': return 'Oops';
    case 'hurry-up': return 'Hurry up';
    case 'well-played': return 'Well played';
    case 'rematch': return 'Rematch?';
    default: return 'sent a message';
  }
}

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
  selectedCard: CardCode | null;
  highlightedCells: Set<string>;
  celebrationState: CelebrationState;
  cutCards: CutCard[] | null;
  winnerInfo: { teamIndex: number; teamColor: string } | null;
  pendingTeamSwitchRequest: TeamSwitchRequest | null;
  latestNotice: RealtimeNotice | null;

  // Connection
  connectionStatus: ConnectionStatus;
  wsConnected: boolean;

  // Pending invite
  pendingRoomCode: string | null;

  // Actions
  createRoom: (payload: CreateRoomPayload, authToken: string) => Promise<void>;
  createBotGame: (payload: CreateBotGamePayload, authToken: string) => Promise<void>;
  joinRoom: (code: string, playerName: string, authToken: string) => Promise<void>;
  leaveRoom: (intent?: 'leave' | 'end') => void;
  reconnectToRoom: (authToken?: string | null) => Promise<void>;
  toggleReady: () => void;
  startGame: () => void;
  sendGameAction: (action: GameAction) => Promise<void>;
  addBot: (difficulty: string) => void;
  kickPlayer: (playerId: string) => void;
  removeBot: (botPlayerId: string) => void;
  updateRoomSettings: (settings: UpdateRoomSettingsPayload) => void;
  requestTeamSwitch: (targetTeamIndex: number) => void;
  respondToTeamSwitch: (playerId: string, approve: boolean) => void;
  continueSeries: () => Promise<{ seriesComplete?: boolean }>;
  endSeries: () => Promise<void>;
  sendEmote: (emote: EmoteType) => void;
  sendQuickMessage: (message: QuickMessageType) => void;
  clearLatestNotice: () => void;
  selectCard: (card: CardCode | null) => void;
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
  pendingTeamSwitchRequest: null,
  latestNotice: null,

  // Connection
  connectionStatus: { phase: 'idle', message: null, attempt: 0, canRetry: false },
  wsConnected: false,

  // Pending invite
  pendingRoomCode: null,

  createRoom: async (payload, authToken) => {
    set({ connectionStatus: { phase: 'connecting', message: 'Creating room...', attempt: 0, canRetry: false } });
    try {
      await get()._connectWebSocket('/ws/create', authToken);
      const result = await socket.request('create-room', payload) as { success?: boolean; roomCode?: string; playerId?: string; token?: string; error?: string };

      if (!result.success || !result.roomCode || !result.playerId || !result.token) {
        throw new Error(result.error ?? 'Failed to create room');
      }

      set({ roomCode: result.roomCode, playerId: result.playerId, roomToken: result.token });
      await get()._saveRoomSession(result.roomCode, result.token, result.playerId);
    } catch (error: any) {
      set({ connectionStatus: { phase: 'terminalFailure', message: error.message, attempt: 0, canRetry: true } });
      socket.disconnect();
      throw error;
    }
  },

  createBotGame: async (payload, authToken) => {
    set({ connectionStatus: { phase: 'connecting', message: 'Starting practice game...', attempt: 0, canRetry: false } });
    try {
      await get()._connectWebSocket('/ws/create', authToken);
      const result = await socket.request('create-bot-game', payload) as { success?: boolean; roomCode?: string; playerId?: string; token?: string; error?: string };

      if (!result.success || !result.roomCode || !result.playerId || !result.token) {
        throw new Error(result.error ?? 'Failed to start practice game');
      }

      set({ roomCode: result.roomCode, playerId: result.playerId, roomToken: result.token });
      await get()._saveRoomSession(result.roomCode, result.token, result.playerId);
    } catch (error: any) {
      set({ connectionStatus: { phase: 'terminalFailure', message: error.message, attempt: 0, canRetry: true } });
      socket.disconnect();
      throw error;
    }
  },

  joinRoom: async (code, playerName, authToken) => {
    set({ connectionStatus: { phase: 'connecting', message: 'Joining room...', attempt: 0, canRetry: false } });
    try {
      await get()._connectWebSocket(`/ws/room/${code}`, authToken);
      const result = await socket.request('join-room', { roomCode: code, playerName }) as {
        success?: boolean;
        roomInfo?: RoomInfo;
        playerId?: string;
        token?: string;
        error?: string;
      };

      if (!result.success || !result.roomInfo || !result.playerId || !result.token) {
        throw new Error(result.error ?? 'Failed to join room');
      }

      set({
        roomInfo: result.roomInfo,
        roomCode: code,
        playerId: result.playerId,
        roomToken: result.token,
      });
      await get()._saveRoomSession(code, result.token, result.playerId);
    } catch (error: any) {
      set({ connectionStatus: { phase: 'terminalFailure', message: error.message, attempt: 0, canRetry: true } });
      socket.disconnect();
      throw error;
    }
  },

  leaveRoom: (intent = 'leave') => {
    if (socket.isConnected) {
      socket.send('leave-room', { intent });
    }
    socket.disconnect();
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    reconnectInFlight = false;
    set({
      roomInfo: null, roomCode: null, playerId: null, roomToken: null,
      gameState: null, selectedCard: null, highlightedCells: new Set(),
      celebrationState: null, cutCards: null, winnerInfo: null,
      pendingTeamSwitchRequest: null, latestNotice: null,
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
      const effectiveAuthToken = authToken ?? useAuthStore.getState().sessionToken ?? undefined;
      await get()._connectWebSocket(`/ws/reconnect?token=${encodeURIComponent(session.token)}`, effectiveAuthToken);
      const result = await socket.request('reconnect-to-room', {
        roomCode: session.roomCode,
        token: session.token,
      }) as {
        success?: boolean;
        roomInfo?: RoomInfo;
        gameState?: ClientGameState;
        playerId?: string;
        error?: string;
        errorCode?: string;
      };

      if (result.success && result.roomInfo) {
        set({
          roomInfo: result.roomInfo,
          roomCode: session.roomCode,
          playerId: result.playerId ?? session.playerId,
          roomToken: session.token,
          gameState: result.gameState ?? null,
          selectedCard: null,
          highlightedCells: new Set(),
          connectionStatus: { phase: 'attached', message: null, attempt: 0, canRetry: false },
          wsConnected: true,
        });
        await get()._saveRoomSession(session.roomCode, session.token, result.playerId ?? session.playerId);
      } else {
        await get()._clearRoomSession();
        set({ connectionStatus: { phase: 'terminalFailure', message: result.error ?? result.errorCode ?? 'Room not found', attempt: 0, canRetry: false } });
        socket.disconnect();
      }
    } catch (error: any) {
      set({ connectionStatus: { phase: 'offline', message: error.message, attempt: 0, canRetry: true } });
      socket.disconnect();
    }
  },

  toggleReady: () => {
    void socket.request('toggle-ready').catch((error: Error) => {
      console.warn('Toggle ready failed:', error.message);
    });
  },

  startGame: () => {
    void socket.request('start-game').catch((error: Error) => {
      console.warn('Start game failed:', error.message);
    });
  },

  sendGameAction: async (action: GameAction) => {
    const result = await socket.request('game-action', action) as { success?: boolean; error?: string };
    if (!result.success) {
      throw new Error(result.error ?? 'Game action failed');
    }
  },

  addBot: (difficulty: string) => {
    void socket.request('add-bot', { difficulty }).catch((error: Error) => {
      console.warn('Add bot failed:', error.message);
    });
  },

  kickPlayer: (playerId: string) => {
    void socket.request('kick-player', { playerId }).catch((error: Error) => {
      console.warn('Kick player failed:', error.message);
    });
  },

  removeBot: (botPlayerId: string) => {
    void socket.request('remove-bot', { botPlayerId }).catch((error: Error) => {
      console.warn('Remove bot failed:', error.message);
    });
  },

  updateRoomSettings: (settings: UpdateRoomSettingsPayload) => {
    void socket.request('update-room-settings', settings).catch((error: Error) => {
      console.warn('Update room settings failed:', error.message);
    });
  },

  requestTeamSwitch: (targetTeamIndex: number) => {
    void socket.request('request-team-switch', { toTeamIndex: targetTeamIndex }).catch((error: Error) => {
      console.warn('Request team switch failed:', error.message);
    });
  },

  respondToTeamSwitch: (requestingPlayerId: string, approve: boolean) => {
    void socket.request('respond-team-switch', { playerId: requestingPlayerId, approved: approve }).then(() => {
      set({ pendingTeamSwitchRequest: null });
    }).catch((error: Error) => {
      console.warn('Respond team switch failed:', error.message);
    });
  },

  continueSeries: async () => {
    const result = await socket.request('continue-series') as { success?: boolean; error?: string; seriesComplete?: boolean; roomInfo?: RoomInfo };
    if (!result.success) {
      throw new Error(result.error ?? 'Failed to continue series');
    }
    if (result.roomInfo) {
      set({ roomInfo: result.roomInfo });
    }
    return { seriesComplete: result.seriesComplete };
  },

  endSeries: async () => {
    const result = await socket.request('end-series') as { success?: boolean; error?: string };
    if (!result.success) {
      throw new Error(result.error ?? 'Failed to end series');
    }
  },

  sendEmote: (emote: EmoteType) => {
    socket.send('send-emote', { emote });
  },

  sendQuickMessage: (message: QuickMessageType) => {
    socket.send('send-quick-message', { message });
  },

  clearLatestNotice: () => {
    set({ latestNotice: null });
  },

  selectCard: (card: CardCode | null) => {
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
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    reconnectInFlight = false;
    set({
      roomInfo: null, roomCode: null, playerId: null, roomToken: null,
      gameState: null, selectedCard: null, highlightedCells: new Set(),
      celebrationState: null, cutCards: null, winnerInfo: null,
      pendingTeamSwitchRequest: null, latestNotice: null,
      connectionStatus: { phase: 'idle', message: null, attempt: 0, canRetry: false },
      wsConnected: false,
    });
    get()._clearRoomSession();
  },

  handleWebSocketMessage: (type: string, data: any) => {
    const state = get();
    switch (type) {
      case 'room-updated':
        set({ roomInfo: data as RoomInfo });
        break;

      case 'game-started':
      case 'game-state-updated': {
        const gameState = data as ClientGameState;
        const winnerTeamIndex = gameState.winnerTeamIndex;
        set({
          gameState,
          cutCards: gameState.cutCards ?? state.cutCards,
          winnerInfo: winnerTeamIndex !== null && winnerTeamIndex !== undefined
            ? {
                teamIndex: winnerTeamIndex,
                teamColor: gameState.config.teamColors[winnerTeamIndex],
              }
            : gameState.phase === 'playing' ? null : state.winnerInfo,
          selectedCard: gameState.phase === 'playing' ? null : state.selectedCard,
          highlightedCells: gameState.phase === 'playing' ? new Set() : state.highlightedCells,
        });
        break;
      }

      case 'player-disconnected':
      case 'player-reconnected':
      case 'player-left':
      case 'game-mode-changed':
        break;

      case 'cut-result':
        set({ cutCards: data?.cutCards ?? null });
        break;

      case 'game-over':
        if (state.gameState && data?.winnerTeamIndex !== undefined && data?.winnerTeamIndex !== null) {
          set({
            winnerInfo: {
              teamIndex: data.winnerTeamIndex,
              teamColor: state.gameState.config.teamColors[data.winnerTeamIndex],
            },
          });
        }
        break;

      case 'room-closed':
        set({
          wsConnected: false,
          connectionStatus: {
            phase: 'terminalFailure',
            message: typeof data === 'string' ? data : 'Room closed',
            attempt: 0,
            canRetry: false,
          },
        });
        break;

      case 'team-switch-request':
        set({ pendingTeamSwitchRequest: data as TeamSwitchRequest });
        break;

      case 'team-switch-response':
        set({
          latestNotice: {
            id: ++noticeId,
            type: data?.approved ? 'success' : 'warning',
            message: data?.approved ? 'Team switch approved' : 'Team switch declined',
          },
        });
        break;

      case 'turn-timeout':
        set({
          latestNotice: {
            id: ++noticeId,
            type: 'warning',
            message: data?.playerName ? `${data.playerName}'s turn timed out` : 'Turn timed out',
          },
        });
        break;

      case 'emote-received':
        set({
          latestNotice: {
            id: ++noticeId,
            type: 'success',
            message: `${data?.playerName ?? 'Player'}: ${formatEmote(data?.emote)}`,
          },
        });
        break;

      case 'quick-message-received':
        set({
          latestNotice: {
            id: ++noticeId,
            type: 'success',
            message: `${data?.playerName ?? 'Player'}: ${formatQuickMessage(data?.message)}`,
          },
        });
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
    if (!socketBindingsInitialized) {
      socket.onMessage((type, data) => {
        get().handleWebSocketMessage(type, data);
      });

      socket.onStatus((status, info) => {
        if (status === 'disconnected') {
          const currentStatus = get().connectionStatus;
          if (info?.code === 1000 && currentStatus.phase === 'terminalFailure') {
            set({ wsConnected: false });
            return;
          }

          set({ wsConnected: false, connectionStatus: { phase: 'offline', message: 'Connection lost', attempt: 0, canRetry: true } });

          const { roomCode, roomToken } = get();
          const shouldReconnect = info?.code !== 1000 && !!roomCode && !!roomToken && !reconnectInFlight;
          if (shouldReconnect) {
            if (reconnectTimer) {
              clearTimeout(reconnectTimer);
            }
            reconnectTimer = setTimeout(() => {
              reconnectTimer = null;
              reconnectInFlight = true;
              const authToken = useAuthStore.getState().sessionToken;
              get().reconnectToRoom(authToken).finally(() => {
                reconnectInFlight = false;
              });
            }, 300);
          }
        } else if (status === 'reconnecting') {
          set({ connectionStatus: { phase: 'recovering', message: 'Reconnecting...', attempt: 0, canRetry: false } });
        } else if (status === 'connected') {
          set({ wsConnected: true, connectionStatus: { phase: 'attached', message: null, attempt: 0, canRetry: false } });
        }
      });

      socketBindingsInitialized = true;
    }

    try {
      await socket.connect(path, authToken);
      set({ wsConnected: true, connectionStatus: { phase: 'attached', message: null, attempt: 0, canRetry: false } });
    } catch (error: any) {
      set({ connectionStatus: { phase: 'terminalFailure', message: error.message, attempt: 0, canRetry: true } });
      throw error;
    }
  },
}));
