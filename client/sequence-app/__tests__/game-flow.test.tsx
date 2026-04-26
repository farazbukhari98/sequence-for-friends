import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import LobbyScreen from '@/app/(game)/lobby';
import GameScreen from '@/app/(game)/game';
import ResultsScreen from '@/app/(game)/results';
import { useAuthStore } from '@/stores/authStore';
import { useFriendsStore } from '@/stores/friendsStore';
import { useGameStore } from '@/stores/gameStore';
import type { ClientGameState, PublicPlayer, RoomInfo, UserProfile } from '@/types/game';

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
};

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
}));

const initialAuthState = useAuthStore.getState();
const initialFriendsState = useFriendsStore.getState();
const initialGameState = useGameStore.getState();

const testUser: UserProfile = {
  id: 'user-1',
  username: 'playerone',
  displayName: 'Player One',
  avatarId: 'star',
  avatarColor: '#123456',
  createdAt: null,
};

function makePlayers(): PublicPlayer[] {
  return [
    {
      id: 'player-1',
      name: 'Player One',
      seatIndex: 0,
      teamIndex: 0,
      teamColor: 'blue',
      connected: true,
      ready: true,
      handCount: 7,
      topDiscard: null,
      discardCount: 0,
    },
    {
      id: 'player-2',
      name: 'Bot',
      seatIndex: 1,
      teamIndex: 1,
      teamColor: 'green',
      connected: true,
      ready: true,
      handCount: 7,
      topDiscard: null,
      discardCount: 0,
      isBot: true,
    },
  ];
}

function makeRoomInfo(phase: RoomInfo['phase'] = 'waiting'): RoomInfo {
  return {
    code: 'SOLO1',
    name: 'Practice Game',
    hostId: 'player-1',
    phase,
    players: makePlayers(),
    maxPlayers: 2,
    teamCount: 2,
    gameVariant: 'classic',
    turnTimeLimit: 30,
    sequencesToWin: 2,
    sequenceLength: 5,
    seriesLength: 0,
    seriesState: null,
  };
}

function makeGameState(overrides: Partial<ClientGameState> = {}): ClientGameState {
  return {
    phase: 'playing',
    config: {
      playerCount: 2,
      teamCount: 2,
      teamColors: ['blue', 'green'],
      gameVariant: 'classic',
      sequencesToWin: 2,
      scoreToWin: 2,
      sequenceLength: 5,
      handSize: 7,
    },
    players: makePlayers(),
    dealerIndex: 0,
    currentPlayerIndex: 0,
    deckCount: 90,
    boardChips: Array.from({ length: 10 }, () => Array(10).fill(null)),
    lockedCells: [[], []],
    sequencesCompleted: [0, 0],
    teamScores: [0, 0],
    completedSequences: [],
    myHand: ['AS', 'JD', 'KH', 'QC', '9D', '2S', 'TC'],
    myPlayerId: 'player-1',
    deadCardReplacedThisTurn: false,
    pendingDraw: false,
    lastRemovedCell: null,
    winnerTeamIndex: null,
    lastMove: null,
    cutCards: [],
    turnTimeLimit: 30,
    turnStartedAt: Date.now(),
    eventLog: [],
    ...overrides,
  };
}

function resetStores() {
  useAuthStore.setState(
    {
      ...initialAuthState,
      user: testUser,
      sessionToken: 'session-token',
      isLoading: false,
      needsUsername: false,
      tempToken: null,
      suggestedName: null,
      errorMessage: null,
      connectionPhase: 'idle',
      usernameAvailability: { checking: false, available: null, error: null },
    },
    true,
  );

  useFriendsStore.setState(
    {
      ...initialFriendsState,
      friends: [],
      friendRequests: [],
      searchResults: [],
      searchQuery: '',
      isSearching: false,
      viewingProfile: null,
      viewingDetailedStats: null,
      headToHead: null,
      gameHistoryList: [],
      gameHistoryHasMore: true,
      gameHistoryOffset: 0,
      isLoadingHistory: false,
      isLoadingFriends: false,
      isLoadingRequests: false,
      isLoadingProfile: false,
      errorMessage: null,
      loadFriends: jest.fn().mockResolvedValue(undefined),
      loadFriendRequests: jest.fn().mockResolvedValue(undefined),
      searchProfiles: jest.fn().mockResolvedValue(undefined),
      clearSearch: jest.fn(),
      sendFriendRequest: jest.fn().mockResolvedValue(true),
      acceptFriendRequest: jest.fn().mockResolvedValue(true),
      rejectFriendRequest: jest.fn().mockResolvedValue(true),
      removeFriend: jest.fn().mockResolvedValue(true),
      loadFriendProfile: jest.fn().mockResolvedValue(undefined),
      loadDetailedStats: jest.fn().mockResolvedValue(undefined),
      loadHeadToHead: jest.fn().mockResolvedValue(undefined),
      loadGameHistory: jest.fn().mockResolvedValue(undefined),
      inviteFriend: jest.fn().mockResolvedValue(true),
      clearProfile: jest.fn(),
      clearError: jest.fn(),
    },
    true,
  );

  useGameStore.setState(
    {
      ...initialGameState,
      roomInfo: null,
      roomCode: 'SOLO1',
      playerId: 'player-1',
      roomToken: 'room-token',
      gameState: null,
      selectedCard: null,
      highlightedCells: new Set(),
      celebrationState: null,
      cutCards: null,
      winnerInfo: null,
      connectionStatus: { phase: 'idle', message: null, attempt: 0, canRetry: false },
      wsConnected: true,
      pendingRoomCode: null,
    },
    true,
  );
}

describe('game flow', () => {
  beforeEach(() => {
    resetStores();
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  });

  it('keeps the lobby stable when room data arrives after the loading render', async () => {
    render(<LobbyScreen />);

    expect(screen.getByText('Loading room...')).toBeOnTheScreen();

    act(() => {
      useGameStore.setState({
        roomInfo: makeRoomInfo('in-game'),
        gameState: makeGameState(),
      });
    });

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/(game)/game'));
  });

  it('keeps the game screen stable when game state arrives after the loading render', async () => {
    render(<GameScreen />);

    act(() => {
      useGameStore.setState({
        gameState: makeGameState(),
      });
    });

    await waitFor(() => expect(screen.getByText('Your turn!')).toBeOnTheScreen());
  });

  it('shows the draw action when a played card is waiting for draw completion', () => {
    useGameStore.setState({
      gameState: makeGameState({ pendingDraw: true }),
    });

    render(<GameScreen />);

    expect(screen.getByText('Draw Card')).toBeOnTheScreen();
    expect(screen.getByText('Draw a card to end your turn.')).toBeOnTheScreen();
  });

  it('does not show the draw action to other players while the current player is pending draw', () => {
    useGameStore.setState({
      playerId: 'player-2',
      gameState: makeGameState({
        pendingDraw: true,
        myPlayerId: 'player-2',
        currentPlayerIndex: 0,
      }),
    });

    render(<GameScreen />);

    expect(screen.queryByText('Draw Card')).toBeNull();
    expect(screen.queryByText('Draw a card to end your turn.')).toBeNull();
    expect(screen.getByText('Waiting for Player One...')).toBeOnTheScreen();
  });

  it('shows a retryable connection overlay on the game screen', async () => {
    const reconnectToRoom = jest.fn().mockResolvedValue(undefined);
    useGameStore.setState({
      gameState: makeGameState(),
      connectionStatus: { phase: 'offline', message: 'Connection lost', attempt: 0, canRetry: true },
      wsConnected: false,
      reconnectToRoom,
    });

    render(<GameScreen />);

    expect(screen.getAllByText('Connection lost').length).toBeGreaterThan(0);
    fireEvent.press(screen.getByText('Retry'));

    await waitFor(() => expect(reconnectToRoom).toHaveBeenCalledWith('session-token'));
  });

  it('prompts before leaving an active game', () => {
    useGameStore.setState({
      roomInfo: makeRoomInfo('in-game'),
      gameState: makeGameState(),
    });

    render(<GameScreen />);

    fireEvent.press(screen.getByLabelText('Leave game'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Leave Game',
      expect.stringContaining('host'),
      expect.arrayContaining([
        expect.objectContaining({ text: 'Leave and Transfer Host' }),
        expect.objectContaining({ text: 'End Game' }),
      ]),
    );
  });

  it('moves non-host players from results into the next series game when the server broadcasts it', async () => {
    useGameStore.setState({
      playerId: 'player-2',
      roomInfo: {
        ...makeRoomInfo('in-game'),
        seriesLength: 3,
        seriesState: {
          seriesLength: 3,
          seriesId: 'series-1',
          gamesPlayed: 0,
          teamWins: [0, 0],
          seriesWinnerTeamIndex: null,
        },
      },
      gameState: makeGameState({
        phase: 'finished',
        myPlayerId: 'player-2',
        winnerTeamIndex: 0,
      }),
      winnerInfo: { teamIndex: 0, teamColor: 'blue' },
    });

    render(<ResultsScreen />);
    expect(mockRouter.replace).not.toHaveBeenCalledWith('/(game)/game');

    act(() => {
      useGameStore.getState().handleWebSocketMessage('game-state-updated', makeGameState({
        phase: 'playing',
        myPlayerId: 'player-2',
        winnerTeamIndex: null,
      }));
    });

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/(game)/game'));
    expect(useGameStore.getState().winnerInfo).toBeNull();
  });
});
