import { useEffect, useRef, useState, useCallback } from 'react';
import { SequenceWebSocket } from '../lib/websocket';
import { useAppLifecycle } from './useAppLifecycle';
import { getApiToken } from '../lib/api';
import type {
  RoomInfo,
  ClientGameState,
  GameAction,
  MoveResult,
  CutCard,
  TurnTimeLimit,
  SequencesToWin,
  TeamSwitchRequest,
  SequenceLength,
  SeriesLength,
  BotDifficulty,
} from '../../../shared/types';

// Game mode info from server
export interface GameModeInfo {
  modes: string[];
  changedBy: string;
  settings: {
    sequenceLength: number;
    turnTimeLimit: number;
    seriesLength: number;
  };
}

interface UseSocketReturn {
  socket: SequenceWebSocket | null;
  connected: boolean;
  roomInfo: RoomInfo | null;
  gameState: ClientGameState | null;
  error: string | null;
  cutCards: CutCard[] | null;
  turnTimeoutInfo: { playerIndex: number; playerName: string } | null;
  teamSwitchRequest: TeamSwitchRequest | null;
  teamSwitchResponse: { playerId: string; approved: boolean; playerName: string } | null;
  gameModeInfo: GameModeInfo | null;
  roomClosed: string | null;
  // Actions
  createRoom: (roomName: string, playerName: string, maxPlayers: number, teamCount: number, turnTimeLimit?: TurnTimeLimit, sequencesToWin?: SequencesToWin) => Promise<{ roomCode: string; playerId: string; token: string } | { error: string }>;
  createBotGame: (playerName: string, difficulty: BotDifficulty, sequenceLength?: SequenceLength, sequencesToWin?: SequencesToWin, seriesLength?: SeriesLength) => Promise<{ roomCode: string; playerId: string; token: string } | { error: string }>;
  joinRoom: (roomCode: string, playerName: string, token?: string) => Promise<{ roomInfo: RoomInfo; playerId: string; token: string } | { error: string }>;
  reconnect: (roomCode: string, token: string) => Promise<{ roomInfo: RoomInfo; gameState?: ClientGameState; playerId: string } | { error: string }>;
  leaveRoom: () => void;
  kickPlayer: (playerId: string) => void;
  addBot: (difficulty: BotDifficulty) => Promise<{ success: boolean; error?: string }>;
  startGame: () => Promise<{ success: boolean; error?: string }>;
  sendAction: (action: GameAction) => Promise<MoveResult>;
  updateRoomSettings: (settings: { turnTimeLimit?: TurnTimeLimit; sequencesToWin?: SequencesToWin; sequenceLength?: SequenceLength; seriesLength?: SeriesLength }) => Promise<{ success: boolean; error?: string }>;
  toggleReady: () => Promise<{ success: boolean; error?: string }>;
  requestTeamSwitch: (toTeamIndex: number) => Promise<{ success: boolean; error?: string }>;
  respondTeamSwitch: (playerId: string, approved: boolean) => Promise<{ success: boolean; error?: string }>;
  continueSeries: () => Promise<{ success: boolean; error?: string }>;
  endSeries: () => Promise<{ success: boolean; error?: string }>;
  clearError: () => void;
  clearTurnTimeoutInfo: () => void;
  clearTeamSwitchRequest: () => void;
  clearTeamSwitchResponse: () => void;
  clearGameModeInfo: () => void;
  clearRoomClosed: () => void;
}

// ============================================
// URL HELPERS
// ============================================

const PRODUCTION_WS_URL = 'wss://sequence-for-friends.farazbukhari98.workers.dev';

function getBaseUrl(): string {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  // Capacitor on iOS/Android
  if (import.meta.env.PROD && window.location.hostname === 'localhost') {
    return PRODUCTION_WS_URL;
  }
  // Production web
  if (import.meta.env.PROD) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}`;
  }
  // Dev mode
  return 'ws://localhost:8787';
}

function wsUrl(path: string): string {
  const base = `${getBaseUrl()}${path}`;
  const token = getApiToken();
  if (token) {
    const separator = base.includes('?') ? '&' : '?';
    return `${base}${separator}auth=${encodeURIComponent(token)}`;
  }
  return base;
}

// ============================================
// HOOK
// ============================================

export function useSocket(): UseSocketReturn {
  const wsRef = useRef<SequenceWebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null);
  const [gameState, setGameState] = useState<ClientGameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cutCards, setCutCards] = useState<CutCard[] | null>(null);
  const [turnTimeoutInfo, setTurnTimeoutInfo] = useState<{ playerIndex: number; playerName: string } | null>(null);
  const [teamSwitchRequest, setTeamSwitchRequest] = useState<TeamSwitchRequest | null>(null);
  const [teamSwitchResponse, setTeamSwitchResponse] = useState<{ playerId: string; approved: boolean; playerName: string } | null>(null);
  const [gameModeInfo, setGameModeInfo] = useState<GameModeInfo | null>(null);
  const [roomClosed, setRoomClosed] = useState<string | null>(null);

  // Session credentials for auto-reconnect
  const tokenRef = useRef<string | null>(null);
  const roomCodeRef = useRef<string | null>(null);

  /**
   * Connect a WebSocket to a specific path and register all event listeners.
   * Cleans up previous connection if any.
   */
  const connectWs = useCallback((path: string): SequenceWebSocket => {
    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    const ws = new SequenceWebSocket(wsUrl(path));
    wsRef.current = ws;

    ws.onOpen = () => {
      console.log('Connected to server');
      // On initial connect, set connected immediately.
      // On reconnect, defer until reconnect-to-room succeeds (handled in onReconnect).
      if (!tokenRef.current) {
        setConnected(true);
      }
    };

    ws.onClose = () => {
      console.log('Disconnected from server');
      setConnected(false);
    };

    ws.onError = () => {
      // Only show error if we don't have credentials (i.e., not a recoverable disconnect)
      if (!tokenRef.current) {
        setError('Connection failed');
      }
    };

    // After auto-reconnect, send reconnect-to-room to reattach the player to the room.
    // The transport is open but the player isn't in the room yet until this succeeds.
    ws.onReconnect = async () => {
      console.log('WebSocket auto-reconnected, sending reconnect-to-room...');
      const token = tokenRef.current;
      const roomCode = roomCodeRef.current;
      if (!token || !roomCode) {
        // No session to rejoin — just mark connected
        setConnected(true);
        return;
      }
      try {
        const response = await ws.request<any>('reconnect-to-room', { roomCode, token });
        if (response.success && response.roomInfo) {
          setError(null);
          setRoomInfo(response.roomInfo);
          if (response.gameState) {
            setGameState(response.gameState);
          } else {
            setGameState(null); // Clear stale game state
          }
          setConnected(true);
        } else {
          setError(response.error || 'Failed to rejoin room');
        }
      } catch {
        setError('Failed to rejoin room after reconnect');
      }
    };

    ws.onReconnectFailed = () => {
      setError('Lost connection to server. Please refresh to rejoin.');
    };

    // Register broadcast event handlers
    ws.on('error', (data) => {
      console.error('Server error:', data?.message || data);
      setError(data?.message || String(data));
    });

    ws.on('room-updated', (info) => {
      setRoomInfo(info);
    });

    ws.on('game-started', (state) => {
      setGameState(state);
    });

    ws.on('game-state-updated', (state) => {
      setGameState(state);
    });

    ws.on('cut-result', (data) => {
      setCutCards(data?.cutCards || data);
    });

    ws.on('turn-timeout', (data) => {
      setTurnTimeoutInfo(data);
      setTimeout(() => setTurnTimeoutInfo(null), 3000);
    });

    ws.on('team-switch-request', (request) => {
      setTeamSwitchRequest(request);
    });

    ws.on('team-switch-response', (response) => {
      setTeamSwitchResponse(response);
      setTimeout(() => setTeamSwitchResponse(null), 5000);
    });

    ws.on('game-mode-changed', (data) => {
      setGameModeInfo(data);
    });

    ws.on('room-closed', (reason) => {
      setRoomClosed(typeof reason === 'string' ? reason : (reason as any)?.data || 'Room closed');
      setRoomInfo(null);
      setGameState(null);
      setCutCards(null);
      // Clear credentials — room no longer exists
      tokenRef.current = null;
      roomCodeRef.current = null;
    });

    ws.on('game-over', () => {
      // Game state update will include winner
    });

    ws.on('player-joined', () => {});
    ws.on('player-left', () => {});
    ws.on('player-reconnected', () => {});
    ws.on('player-disconnected', () => {});

    return ws;
  }, []);

  /** Store session credentials and configure reconnect URL */
  const setSessionCredentials = useCallback((roomCode: string, token: string) => {
    tokenRef.current = token;
    roomCodeRef.current = roomCode;
    // Set reconnect URL to the room-specific endpoint (not /ws/create)
    wsRef.current?.setReconnectUrl(wsUrl(`/ws/reconnect?token=${encodeURIComponent(token)}`));
  }, []);

  // Detect app foreground/resume and force WebSocket reconnect
  useAppLifecycle(wsRef, tokenRef);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // ============================================
  // ACTIONS - each connects lazily to appropriate WS endpoint
  // ============================================

  const createRoom = useCallback(async (
    roomName: string,
    playerName: string,
    maxPlayers: number,
    teamCount: number,
    turnTimeLimit: TurnTimeLimit = 0,
    sequencesToWin?: SequencesToWin
  ): Promise<{ roomCode: string; playerId: string; token: string } | { error: string }> => {
    try {
      const ws = connectWs('/ws/create');

      // Wait for connection
      await waitForOpen(ws);

      const response = await ws.request<any>('create-room', {
        roomName, playerName, maxPlayers, teamCount, turnTimeLimit, sequencesToWin,
      });

      if (response.success && response.roomCode && response.playerId && response.token) {
        setSessionCredentials(response.roomCode, response.token);
        return {
          roomCode: response.roomCode,
          playerId: response.playerId,
          token: response.token,
        };
      }
      return { error: response.error || 'Failed to create room' };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Failed to create room' };
    }
  }, [connectWs, setSessionCredentials]);

  const createBotGame = useCallback(async (
    playerName: string,
    difficulty: BotDifficulty,
    sequenceLength?: SequenceLength,
    sequencesToWin?: SequencesToWin,
    seriesLength?: SeriesLength
  ): Promise<{ roomCode: string; playerId: string; token: string } | { error: string }> => {
    try {
      const ws = connectWs('/ws/create');
      await waitForOpen(ws);

      const response = await ws.request<any>('create-bot-game', {
        playerName, difficulty, sequenceLength, sequencesToWin, seriesLength,
      });

      if (response.success && response.roomCode && response.playerId && response.token) {
        setSessionCredentials(response.roomCode, response.token);
        return {
          roomCode: response.roomCode,
          playerId: response.playerId,
          token: response.token,
        };
      }
      return { error: response.error || 'Failed to create bot game' };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Failed to create bot game' };
    }
  }, [connectWs, setSessionCredentials]);

  const joinRoom = useCallback(async (
    roomCode: string,
    playerName: string,
    token?: string
  ): Promise<{ roomInfo: RoomInfo; playerId: string; token: string } | { error: string }> => {
    try {
      const ws = connectWs(`/ws/room/${roomCode.toUpperCase()}`);
      await waitForOpen(ws);

      const response = await ws.request<any>('join-room', {
        roomCode, playerName, token,
      });

      if (response.success && response.roomInfo && response.playerId && response.token) {
        setRoomInfo(response.roomInfo);
        setSessionCredentials(roomCode.toUpperCase(), response.token);
        return {
          roomInfo: response.roomInfo,
          playerId: response.playerId,
          token: response.token,
        };
      }
      return { error: response.error || 'Failed to join room' };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Failed to join room' };
    }
  }, [connectWs, setSessionCredentials]);

  const reconnect = useCallback(async (
    roomCode: string,
    token: string
  ): Promise<{ roomInfo: RoomInfo; gameState?: ClientGameState; playerId: string } | { error: string }> => {
    try {
      const ws = connectWs(`/ws/reconnect?token=${encodeURIComponent(token)}`);
      await waitForOpen(ws);

      const response = await ws.request<any>('reconnect-to-room', {
        roomCode, token,
      });

      if (response.success && response.roomInfo && response.playerId) {
        setRoomInfo(response.roomInfo);
        if (response.gameState) {
          setGameState(response.gameState);
        }
        setSessionCredentials(roomCode.toUpperCase(), token);
        return {
          roomInfo: response.roomInfo,
          gameState: response.gameState,
          playerId: response.playerId,
        };
      }
      return { error: response.error || 'Failed to reconnect' };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Failed to reconnect' };
    }
  }, [connectWs, setSessionCredentials]);

  const leaveRoom = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.send('leave-room');
      wsRef.current.close();
      wsRef.current = null;
    }
    tokenRef.current = null;
    roomCodeRef.current = null;
    setRoomInfo(null);
    setGameState(null);
    setCutCards(null);
    setConnected(false);
  }, []);

  const kickPlayer = useCallback((playerId: string) => {
    wsRef.current?.send('kick-player', { playerId });
  }, []);

  const addBot = useCallback(async (
    difficulty: BotDifficulty
  ): Promise<{ success: boolean; error?: string }> => {
    if (!wsRef.current) return { success: false, error: 'Not connected to server' };
    try {
      const response = await wsRef.current.request<any>('add-bot', { difficulty });
      return { success: response.success !== false, error: response.error };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Failed' };
    }
  }, []);

  const startGame = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!wsRef.current) return { success: false, error: 'Not connected to server' };
    try {
      const response = await wsRef.current.request<any>('start-game');
      return { success: response.success !== false, error: response.error };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Failed' };
    }
  }, []);

  const sendAction = useCallback(async (action: GameAction): Promise<MoveResult> => {
    if (!wsRef.current) return { success: false, error: 'Not connected to server' };
    try {
      const response = await wsRef.current.request<any>('game-action', action);
      if (!response.success && response.error) {
        setError(response.error);
      }
      return response as MoveResult;
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Failed' };
    }
  }, []);

  const updateRoomSettings = useCallback(async (
    settings: { turnTimeLimit?: TurnTimeLimit; sequencesToWin?: SequencesToWin; sequenceLength?: SequenceLength; seriesLength?: SeriesLength }
  ): Promise<{ success: boolean; error?: string }> => {
    if (!wsRef.current) return { success: false, error: 'Not connected to server' };
    try {
      const response = await wsRef.current.request<any>('update-room-settings', settings);
      return { success: response.success !== false, error: response.error };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Failed' };
    }
  }, []);

  const toggleReady = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!wsRef.current) return { success: false, error: 'Not connected to server' };
    try {
      const response = await wsRef.current.request<any>('toggle-ready');
      return { success: response.success !== false, error: response.error };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Failed' };
    }
  }, []);

  const requestTeamSwitch = useCallback(async (
    toTeamIndex: number
  ): Promise<{ success: boolean; error?: string }> => {
    if (!wsRef.current) return { success: false, error: 'Not connected to server' };
    try {
      const response = await wsRef.current.request<any>('request-team-switch', { toTeamIndex });
      return { success: response.success !== false, error: response.error };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Failed' };
    }
  }, []);

  const respondTeamSwitch = useCallback(async (
    playerId: string,
    approved: boolean
  ): Promise<{ success: boolean; error?: string }> => {
    if (!wsRef.current) return { success: false, error: 'Not connected to server' };
    try {
      const response = await wsRef.current.request<any>('respond-team-switch', { playerId, approved });
      return { success: response.success !== false, error: response.error };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Failed' };
    }
  }, []);

  const continueSeries = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!wsRef.current) return { success: false, error: 'Not connected to server' };
    try {
      const response = await wsRef.current.request<any>('continue-series');
      return { success: response.success !== false, error: response.error };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Failed' };
    }
  }, []);

  const endSeries = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!wsRef.current) return { success: false, error: 'Not connected to server' };
    try {
      const response = await wsRef.current.request<any>('end-series');
      return { success: response.success !== false, error: response.error };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Failed' };
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);
  const clearTurnTimeoutInfo = useCallback(() => setTurnTimeoutInfo(null), []);
  const clearTeamSwitchRequest = useCallback(() => setTeamSwitchRequest(null), []);
  const clearTeamSwitchResponse = useCallback(() => setTeamSwitchResponse(null), []);
  const clearGameModeInfo = useCallback(() => setGameModeInfo(null), []);
  const clearRoomClosed = useCallback(() => setRoomClosed(null), []);

  return {
    socket: wsRef.current,
    connected,
    roomInfo,
    gameState,
    error,
    cutCards,
    turnTimeoutInfo,
    teamSwitchRequest,
    teamSwitchResponse,
    gameModeInfo,
    roomClosed,
    createRoom,
    createBotGame,
    joinRoom,
    reconnect,
    leaveRoom,
    kickPlayer,
    addBot,
    startGame,
    sendAction,
    updateRoomSettings,
    toggleReady,
    requestTeamSwitch,
    respondTeamSwitch,
    continueSeries,
    endSeries,
    clearError,
    clearTurnTimeoutInfo,
    clearTeamSwitchRequest,
    clearTeamSwitchResponse,
    clearGameModeInfo,
    clearRoomClosed,
  };
}

// ============================================
// HELPERS
// ============================================

function waitForOpen(ws: SequenceWebSocket, timeoutMs = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ws.connected) {
      resolve();
      return;
    }

    const timeout = setTimeout(() => {
      reject(new Error('Connection timeout'));
    }, timeoutMs);

    const originalOnOpen = ws.onOpen;
    ws.onOpen = () => {
      clearTimeout(timeout);
      originalOnOpen?.();
      resolve();
    };

    const originalOnError = ws.onError;
    ws.onError = (e) => {
      clearTimeout(timeout);
      originalOnError?.(e);
      reject(new Error('Connection failed'));
    };
  });
}
