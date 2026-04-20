import { beforeEach, describe, expect, it, vi } from 'vitest';

const { asyncStorageMock, socketMock } = vi.hoisted(() => ({
  asyncStorageMock: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
  socketMock: {
    connect: vi.fn(),
    request: vi.fn(),
    send: vi.fn(),
    onMessage: vi.fn(),
    onStatus: vi.fn(),
    disconnect: vi.fn(),
    setSession: vi.fn(),
  },
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: asyncStorageMock,
}));

vi.mock('@/services/socket', () => ({
  socket: socketMock,
}));

import { useGameStore } from '@/stores/gameStore';

const baseState = {
  roomInfo: null,
  roomCode: null,
  playerId: null,
  roomToken: null,
  gameState: null,
  selectedCard: null,
  highlightedCells: new Set<string>(),
  celebrationState: null,
  cutCards: null,
  winnerInfo: null,
  connectionStatus: { phase: 'idle' as const, message: null, attempt: 0, canRetry: false },
  wsConnected: false,
  pendingRoomCode: null,
};

describe('gameStore', () => {
  beforeEach(() => {
    useGameStore.setState(baseState);
    vi.clearAllMocks();
    socketMock.onMessage.mockReturnValue(vi.fn());
    socketMock.onStatus.mockReturnValue(vi.fn());
    socketMock.connect.mockResolvedValue(undefined);
  });

  it('creates a room via websocket and persists the session', async () => {
    socketMock.request.mockResolvedValue({
      success: true,
      roomCode: 'ABCD',
      playerId: 'player-1',
      token: 'room-token',
    });

    await useGameStore.getState().createRoom(
      {
        roomName: 'Friends',
        playerName: 'Frosty',
        maxPlayers: 4,
        teamCount: 2,
        turnTimeLimit: 30,
        sequencesToWin: 2,
      },
      'session-token',
    );

    expect(socketMock.connect).toHaveBeenCalledWith('/ws/create', 'session-token');
    expect(socketMock.request).toHaveBeenCalledWith('create-room', {
      roomName: 'Friends',
      playerName: 'Frosty',
      maxPlayers: 4,
      teamCount: 2,
      turnTimeLimit: 30,
      sequencesToWin: 2,
    });
    expect(socketMock.setSession).toHaveBeenCalledWith({
      roomCode: 'ABCD',
      token: 'room-token',
      playerId: 'player-1',
    });
    expect(asyncStorageMock.setItem).toHaveBeenCalledWith(
      'sequence_room_session',
      JSON.stringify({ roomCode: 'ABCD', token: 'room-token', playerId: 'player-1' }),
    );

    expect(useGameStore.getState().roomCode).toBe('ABCD');
    expect(useGameStore.getState().playerId).toBe('player-1');
    expect(useGameStore.getState().roomToken).toBe('room-token');
  });

  it('maps critical websocket events into store state', () => {
    useGameStore.setState({
      roomInfo: {
        code: 'ABCD',
        name: 'Friends',
        hostId: 'host-1',
        phase: 'lobby',
        players: [
          {
            id: 'player-1',
            name: 'Frosty',
            seatIndex: 0,
            teamIndex: 1,
            teamColor: 'green',
            connected: true,
            ready: true,
            handCount: 6,
            topDiscard: null,
            discardCount: 0,
          },
        ],
        maxPlayers: 4,
        teamCount: 2,
        gameVariant: 'classic',
        turnTimeLimit: 30,
        sequencesToWin: 2,
        sequenceLength: 5,
        seriesLength: 1,
        seriesState: null,
      },
    });

    useGameStore.getState().handleWebSocketMessage('cut-result', {
      cutCards: [{ playerId: 'player-1', card: 'AS', rank: 14 }],
    });
    expect(useGameStore.getState().cutCards).toEqual([{ playerId: 'player-1', card: 'AS', rank: 14 }]);

    useGameStore.getState().handleWebSocketMessage('game-state-updated', {
      phase: 'playing',
      players: [],
      config: {
        playerCount: 2,
        teamCount: 2,
        teamColors: ['blue', 'green'],
        gameVariant: 'classic',
        sequencesToWin: 2,
        scoreToWin: 10,
        sequenceLength: 5,
        handSize: 6,
      },
      dealerIndex: 0,
      currentPlayerIndex: 0,
      deckCount: 42,
      boardChips: Array.from({ length: 10 }, () => Array(10).fill(null)),
      lockedCells: [],
      sequencesCompleted: [0, 0],
      teamScores: [0, 0],
      completedSequences: [],
      myHand: [],
      myPlayerId: 'player-1',
      deadCardReplacedThisTurn: false,
      pendingDraw: false,
      lastRemovedCell: null,
      winnerTeamIndex: null,
      lastMove: null,
      cutCards: null,
      turnTimeLimit: 30,
      turnStartedAt: null,
      eventLog: [],
    });
    expect(useGameStore.getState().gameState?.phase).toBe('playing');

    useGameStore.getState().handleWebSocketMessage('game-over', { winnerTeamIndex: 1 });
    expect(useGameStore.getState().winnerInfo).toEqual({ teamIndex: 1, teamColor: 'green' });
  });
});
