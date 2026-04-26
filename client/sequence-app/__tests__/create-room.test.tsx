import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import CreateRoomScreen from '@/app/(main)/create-room';
import { useAuthStore } from '@/stores/authStore';
import { useGameStore } from '@/stores/gameStore';

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
};

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
}));

const initialAuthState = useAuthStore.getState();
const initialGameState = useGameStore.getState();

describe('CreateRoomScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    useAuthStore.setState(
      {
        ...initialAuthState,
        user: {
          id: 'user-1',
          username: 'playerone',
          displayName: 'Player One',
          avatarId: 'star',
          avatarColor: '#123456',
          createdAt: null,
        },
        sessionToken: 'session-token',
        isLoading: false,
      },
      true,
    );

    useGameStore.setState(
      {
        ...initialGameState,
        createRoom: jest.fn().mockResolvedValue(undefined),
      },
      true,
    );
  });

  it('offers only supported turn timer values and submits the selected timer', async () => {
    render(<CreateRoomScreen />);

    expect(screen.queryByTestId('turn-timer-10')).toBeNull();
    expect(screen.queryByTestId('turn-timer-40')).toBeNull();
    expect(screen.queryByTestId('turn-timer-50')).toBeNull();

    fireEvent.press(screen.getByTestId('turn-timer-45'));
    fireEvent.press(screen.getByText('Create Room'));

    await waitFor(() => {
      expect(useGameStore.getState().createRoom).toHaveBeenCalledWith(
        expect.objectContaining({ turnTimeLimit: 45 }),
        'session-token',
      );
    });
    expect(mockRouter.push).toHaveBeenCalledWith('/(game)/lobby');
  });

  it('submits Blitz and best-of series settings', async () => {
    render(<CreateRoomScreen />);

    fireEvent.press(screen.getByText('Blitz'));
    fireEvent.press(screen.getByText('Bo5'));
    fireEvent.press(screen.getByText('Create Room'));

    await waitFor(() => {
      expect(useGameStore.getState().createRoom).toHaveBeenCalledWith(
        expect.objectContaining({
          sequenceLength: 4,
          seriesLength: 5,
        }),
        'session-token',
      );
    });
  });
});
