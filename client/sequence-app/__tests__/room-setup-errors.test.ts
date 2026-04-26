jest.mock('@/services/socket', () => ({
  socket: {
    connect: jest.fn(),
    request: jest.fn(),
    disconnect: jest.fn(),
    onMessage: jest.fn(() => jest.fn()),
    onStatus: jest.fn(() => jest.fn()),
    get isConnected() {
      return false;
    },
  },
}));

import { socket } from '@/services/socket';
import { useGameStore } from '@/stores/gameStore';

const initialGameState = useGameStore.getState();
const mockSocket = socket as jest.Mocked<typeof socket>;

describe('room setup errors', () => {
  beforeEach(() => {
    useGameStore.setState({ ...initialGameState }, true);
    mockSocket.connect.mockReset();
    mockSocket.request.mockReset();
    mockSocket.disconnect.mockReset();
    mockSocket.onMessage.mockClear();
    mockSocket.onStatus.mockClear();
  });

  it('rethrows create room failures so callers do not navigate', async () => {
    mockSocket.connect.mockRejectedValueOnce(new Error('Failed to connect'));

    await expect(
      useGameStore.getState().createRoom({
        roomName: 'Broken Room',
        playerName: 'Player One',
        maxPlayers: 4,
        teamCount: 2,
        turnTimeLimit: 30,
        sequencesToWin: 2,
        sequenceLength: 5,
        seriesLength: 0,
      }, 'session-token'),
    ).rejects.toThrow('Failed to connect');

    expect(useGameStore.getState().connectionStatus).toMatchObject({
      phase: 'terminalFailure',
      message: 'Failed to connect',
      canRetry: true,
    });
    expect(mockSocket.disconnect).toHaveBeenCalled();
  });

  it('rethrows join room failures so callers do not navigate', async () => {
    mockSocket.connect.mockRejectedValueOnce(new Error('Room not found'));

    await expect(
      useGameStore.getState().joinRoom('ABCDE', 'Player One', 'session-token'),
    ).rejects.toThrow('Room not found');

    expect(useGameStore.getState().connectionStatus).toMatchObject({
      phase: 'terminalFailure',
      message: 'Room not found',
      canRetry: true,
    });
    expect(mockSocket.disconnect).toHaveBeenCalled();
  });

  it('rethrows bot game failures so callers do not navigate', async () => {
    mockSocket.connect.mockRejectedValueOnce(new Error('Practice unavailable'));

    await expect(
      useGameStore.getState().createBotGame({
        playerName: 'Player One',
        difficulty: 'easy',
        sequenceLength: 5,
        sequencesToWin: 2,
        seriesLength: 0,
      }, 'session-token'),
    ).rejects.toThrow('Practice unavailable');

    expect(useGameStore.getState().connectionStatus).toMatchObject({
      phase: 'terminalFailure',
      message: 'Practice unavailable',
      canRetry: true,
    });
    expect(mockSocket.disconnect).toHaveBeenCalled();
  });
});
