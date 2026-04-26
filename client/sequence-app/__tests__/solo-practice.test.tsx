import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import SoloPracticeScreen from '@/app/(main)/solo-practice';
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

describe('SoloPracticeScreen', () => {
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
        createBotGame: jest.fn().mockResolvedValue(undefined),
      },
      true,
    );
  });

  it('submits Blitz and best-of series settings for bot games', async () => {
    render(<SoloPracticeScreen />);

    fireEvent.press(screen.getByText('Blitz'));
    fireEvent.press(screen.getByText('Bo3'));
    fireEvent.press(screen.getByText('Deal Solo Game'));

    await waitFor(() => {
      expect(useGameStore.getState().createBotGame).toHaveBeenCalledWith(
        expect.objectContaining({
          sequenceLength: 4,
          seriesLength: 3,
        }),
        'session-token',
      );
    });
    expect(mockRouter.replace).toHaveBeenCalledWith('/(game)/lobby');
  });
});
