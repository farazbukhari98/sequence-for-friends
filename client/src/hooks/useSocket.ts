import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  RoomInfo,
  ClientGameState,
  GameAction,
  MoveResult,
  CutCard,
  TurnTimeLimit,
  TeamSwitchRequest,
} from '../../../shared/types';

type SequenceSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface UseSocketReturn {
  socket: SequenceSocket | null;
  connected: boolean;
  roomInfo: RoomInfo | null;
  gameState: ClientGameState | null;
  error: string | null;
  cutCards: CutCard[] | null;
  turnTimeoutInfo: { playerIndex: number; playerName: string } | null;
  teamSwitchRequest: TeamSwitchRequest | null;
  teamSwitchResponse: { playerId: string; approved: boolean; playerName: string } | null;
  // Actions
  createRoom: (roomName: string, playerName: string, maxPlayers: number, teamCount: number, turnTimeLimit?: TurnTimeLimit) => Promise<{ roomCode: string; playerId: string; token: string } | { error: string }>;
  joinRoom: (roomCode: string, playerName: string, token?: string) => Promise<{ roomInfo: RoomInfo; playerId: string; token: string } | { error: string }>;
  reconnect: (roomCode: string, token: string) => Promise<{ roomInfo: RoomInfo; gameState?: ClientGameState; playerId: string } | { error: string }>;
  leaveRoom: () => void;
  kickPlayer: (playerId: string) => void;
  startGame: () => Promise<{ success: boolean; error?: string }>;
  sendAction: (action: GameAction) => Promise<MoveResult>;
  updateRoomSettings: (turnTimeLimit: TurnTimeLimit) => Promise<{ success: boolean; error?: string }>;
  toggleReady: () => Promise<{ success: boolean; error?: string }>;
  requestTeamSwitch: (toTeamIndex: number) => Promise<{ success: boolean; error?: string }>;
  respondTeamSwitch: (playerId: string, approved: boolean) => Promise<{ success: boolean; error?: string }>;
  clearError: () => void;
  clearTurnTimeoutInfo: () => void;
  clearTeamSwitchRequest: () => void;
  clearTeamSwitchResponse: () => void;
}

const SOCKET_URL = import.meta.env.PROD ? '' : 'http://localhost:3001';

export function useSocket(): UseSocketReturn {
  const socketRef = useRef<SequenceSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null);
  const [gameState, setGameState] = useState<ClientGameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cutCards, setCutCards] = useState<CutCard[] | null>(null);
  const [turnTimeoutInfo, setTurnTimeoutInfo] = useState<{ playerIndex: number; playerName: string } | null>(null);
  const [teamSwitchRequest, setTeamSwitchRequest] = useState<TeamSwitchRequest | null>(null);
  const [teamSwitchResponse, setTeamSwitchResponse] = useState<{ playerId: string; approved: boolean; playerName: string } | null>(null);

  // Initialize socket connection
  useEffect(() => {
    const socket: SequenceSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to server');
      setConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      setConnected(false);
    });

    socket.on('error', (message) => {
      console.error('Server error:', message);
      setError(message);
    });

    socket.on('room-updated', (info) => {
      setRoomInfo(info);
    });

    socket.on('game-started', (state) => {
      setGameState(state);
    });

    socket.on('game-state-updated', (state) => {
      setGameState(state);
    });

    socket.on('cut-result', (cards, _dealerIndex) => {
      setCutCards(cards);
    });

    socket.on('player-joined', (_player) => {
      // Room update will be sent separately
    });

    socket.on('player-left', (_playerId) => {
      // Room update will be sent separately
    });

    socket.on('player-reconnected', (_playerId) => {
      // Room update will be sent separately
    });

    socket.on('player-disconnected', (_playerId) => {
      // Room update will be sent separately
    });

    socket.on('game-over', (_winnerTeamIndex) => {
      // Game state update will include winner
    });

    socket.on('turn-timeout', (data) => {
      setTurnTimeoutInfo(data);
      // Auto-clear after 3 seconds
      setTimeout(() => setTurnTimeoutInfo(null), 3000);
    });

    socket.on('team-switch-request', (request) => {
      setTeamSwitchRequest(request);
    });

    socket.on('team-switch-response', (response) => {
      setTeamSwitchResponse(response);
      // Auto-clear after 5 seconds
      setTimeout(() => setTeamSwitchResponse(null), 5000);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const createRoom = useCallback(async (
    roomName: string,
    playerName: string,
    maxPlayers: number,
    teamCount: number,
    turnTimeLimit: TurnTimeLimit = 0
  ): Promise<{ roomCode: string; playerId: string; token: string } | { error: string }> => {
    return new Promise((resolve) => {
      if (!socketRef.current) {
        resolve({ error: 'Not connected to server' });
        return;
      }

      socketRef.current.emit('create-room', { roomName, playerName, maxPlayers, teamCount, turnTimeLimit }, (response) => {
        if (response.success && response.roomCode && response.playerId && response.token) {
          resolve({
            roomCode: response.roomCode,
            playerId: response.playerId,
            token: response.token,
          });
        } else {
          resolve({ error: response.error || 'Failed to create room' });
        }
      });
    });
  }, []);

  const joinRoom = useCallback(async (
    roomCode: string,
    playerName: string,
    token?: string
  ): Promise<{ roomInfo: RoomInfo; playerId: string; token: string } | { error: string }> => {
    return new Promise((resolve) => {
      if (!socketRef.current) {
        resolve({ error: 'Not connected to server' });
        return;
      }

      socketRef.current.emit('join-room', { roomCode, playerName, token }, (response) => {
        if (response.success && response.roomInfo && response.playerId && response.token) {
          setRoomInfo(response.roomInfo);
          resolve({
            roomInfo: response.roomInfo,
            playerId: response.playerId,
            token: response.token,
          });
        } else {
          resolve({ error: response.error || 'Failed to join room' });
        }
      });
    });
  }, []);

  const reconnect = useCallback(async (
    roomCode: string,
    token: string
  ): Promise<{ roomInfo: RoomInfo; gameState?: ClientGameState; playerId: string } | { error: string }> => {
    return new Promise((resolve) => {
      if (!socketRef.current) {
        resolve({ error: 'Not connected to server' });
        return;
      }

      socketRef.current.emit('reconnect-to-room', { roomCode, token }, (response) => {
        if (response.success && response.roomInfo && response.playerId) {
          setRoomInfo(response.roomInfo);
          if (response.gameState) {
            setGameState(response.gameState);
          }
          resolve({
            roomInfo: response.roomInfo,
            gameState: response.gameState,
            playerId: response.playerId,
          });
        } else {
          resolve({ error: response.error || 'Failed to reconnect' });
        }
      });
    });
  }, []);

  const leaveRoom = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('leave-room');
      setRoomInfo(null);
      setGameState(null);
      setCutCards(null);
    }
  }, []);

  const kickPlayer = useCallback((playerId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('kick-player', playerId);
    }
  }, []);

  const startGame = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    return new Promise((resolve) => {
      if (!socketRef.current) {
        resolve({ success: false, error: 'Not connected to server' });
        return;
      }

      socketRef.current.emit('start-game', (response) => {
        resolve(response);
      });
    });
  }, []);

  const sendAction = useCallback(async (action: GameAction): Promise<MoveResult> => {
    return new Promise((resolve) => {
      if (!socketRef.current) {
        resolve({ success: false, error: 'Not connected to server' });
        return;
      }

      socketRef.current.emit('game-action', action, (response) => {
        if (!response.success && response.error) {
          setError(response.error);
        }
        resolve(response);
      });
    });
  }, []);

  const updateRoomSettings = useCallback(async (
    turnTimeLimit: TurnTimeLimit
  ): Promise<{ success: boolean; error?: string }> => {
    return new Promise((resolve) => {
      if (!socketRef.current) {
        resolve({ success: false, error: 'Not connected to server' });
        return;
      }

      socketRef.current.emit('update-room-settings', { turnTimeLimit }, (response) => {
        resolve(response);
      });
    });
  }, []);

  const toggleReady = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    return new Promise((resolve) => {
      if (!socketRef.current) {
        resolve({ success: false, error: 'Not connected to server' });
        return;
      }

      socketRef.current.emit('toggle-ready', (response) => {
        resolve(response);
      });
    });
  }, []);

  const requestTeamSwitch = useCallback(async (
    toTeamIndex: number
  ): Promise<{ success: boolean; error?: string }> => {
    return new Promise((resolve) => {
      if (!socketRef.current) {
        resolve({ success: false, error: 'Not connected to server' });
        return;
      }

      socketRef.current.emit('request-team-switch', toTeamIndex, (response) => {
        resolve(response);
      });
    });
  }, []);

  const respondTeamSwitch = useCallback(async (
    playerId: string,
    approved: boolean
  ): Promise<{ success: boolean; error?: string }> => {
    return new Promise((resolve) => {
      if (!socketRef.current) {
        resolve({ success: false, error: 'Not connected to server' });
        return;
      }

      socketRef.current.emit('respond-team-switch', { playerId, approved }, (response) => {
        resolve(response);
      });
    });
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearTurnTimeoutInfo = useCallback(() => {
    setTurnTimeoutInfo(null);
  }, []);

  const clearTeamSwitchRequest = useCallback(() => {
    setTeamSwitchRequest(null);
  }, []);

  const clearTeamSwitchResponse = useCallback(() => {
    setTeamSwitchResponse(null);
  }, []);

  return {
    socket: socketRef.current,
    connected,
    roomInfo,
    gameState,
    error,
    cutCards,
    turnTimeoutInfo,
    teamSwitchRequest,
    teamSwitchResponse,
    createRoom,
    joinRoom,
    reconnect,
    leaveRoom,
    kickPlayer,
    startGame,
    sendAction,
    updateRoomSettings,
    toggleReady,
    requestTeamSwitch,
    respondTeamSwitch,
    clearError,
    clearTurnTimeoutInfo,
    clearTeamSwitchRequest,
    clearTeamSwitchResponse,
  };
}
