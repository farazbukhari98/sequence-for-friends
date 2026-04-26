import React from 'react';
import { Text } from 'react-native';
import { Slot } from 'expo-router';
import { act, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import type { UserProfile } from '@/types/game';
import IndexRoute from '@/app/index';
import AuthLayout from '@/app/(auth)/_layout';
import MainLayout from '@/app/(main)/_layout';
import GameLayout from '@/app/(game)/_layout';
import JoinInviteRoute from '@/app/join/[roomCode]';
import { useAuthStore } from '@/stores/authStore';
import { useGameStore } from '@/stores/gameStore';

const initialAuthState = useAuthStore.getState();
const initialGameState = useGameStore.getState();

const testUser: UserProfile = {
  id: 'user-1',
  username: 'playerone',
  displayName: 'Player One',
  avatarId: 'star',
  avatarColor: '#123456',
  createdAt: null,
};

function RootTestLayout() {
  return <Slot />;
}

function makeScreen(label: string) {
  return function ScreenStub() {
    return <Text>{label}</Text>;
  };
}

const routes = {
  _layout: { default: RootTestLayout },
  index: { default: IndexRoute },
  '(auth)/_layout': { default: AuthLayout },
  '(auth)/login': { default: makeScreen('Login Screen') },
  '(auth)/onboarding': { default: makeScreen('Onboarding Screen') },
  '(main)/_layout': { default: MainLayout },
  '(main)/home': { default: makeScreen('Home Screen') },
  '(main)/create-room': { default: makeScreen('Create Room Screen') },
  '(main)/join-room': { default: makeScreen('Join Room Screen') },
  '(main)/solo-practice': { default: makeScreen('Solo Practice Screen') },
  '(main)/friends': { default: makeScreen('Friends Screen') },
  '(main)/friend-profile': { default: makeScreen('Friend Profile Screen') },
  '(main)/profile': { default: makeScreen('Profile Screen') },
  '(main)/game-history': { default: makeScreen('Game History Screen') },
  '(main)/detailed-stats': { default: makeScreen('Detailed Stats Screen') },
  '(game)/_layout': { default: GameLayout },
  '(game)/lobby': { default: makeScreen('Lobby Screen') },
  '(game)/game': { default: makeScreen('Game Screen') },
  '(game)/results': { default: makeScreen('Results Screen') },
  'join/[roomCode]': { default: JoinInviteRoute },
  'invite/[roomCode]': { default: JoinInviteRoute },
};

function seedAuthState(partialState: Partial<typeof initialAuthState> = {}) {
  useAuthStore.setState(
    {
      ...initialAuthState,
      user: null,
      sessionToken: null,
      connectionPhase: 'idle',
      errorMessage: null,
      isLoading: false,
      needsUsername: false,
      tempToken: null,
      suggestedName: null,
      usernameAvailability: { checking: false, available: null, error: null },
      ...partialState,
    },
    true,
  );

  useGameStore.setState(
    {
      ...initialGameState,
      pendingRoomCode: null,
    },
    true,
  );
}

async function renderApp(initialUrl: string) {
  const result = renderRouter(routes, { initialUrl });

  act(() => {
    jest.runOnlyPendingTimers();
  });

  return result;
}

describe('auth routing', () => {
  beforeEach(() => {
    seedAuthState();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('routes unauthenticated root users to login', async () => {
    const router = await renderApp('/');

    await waitFor(() => expect(router.getPathname()).toBe('/login'));
    expect(screen.getByText('Login Screen')).toBeOnTheScreen();
  });

  it('routes incomplete registrations to onboarding', async () => {
    seedAuthState({ needsUsername: true, tempToken: 'temp-token' });
    const router = await renderApp('/');

    await waitFor(() => expect(router.getPathname()).toBe('/onboarding'));
    expect(screen.getByText('Onboarding Screen')).toBeOnTheScreen();
  });

  it('routes authenticated root users to home', async () => {
    seedAuthState({ user: testUser, sessionToken: 'session-token' });
    const router = await renderApp('/');

    await waitFor(() => expect(router.getPathname()).toBe('/home'));
    expect(screen.getByText('Home Screen')).toBeOnTheScreen();
  });

  it('redirects unauthenticated main routes to login', async () => {
    const router = await renderApp('/friends');

    await waitFor(() => expect(router.getPathname()).toBe('/login'));
    expect(screen.getByText('Login Screen')).toBeOnTheScreen();
  });

  it('redirects unauthenticated game routes to login', async () => {
    const router = await renderApp('/game');

    await waitFor(() => expect(router.getPathname()).toBe('/login'));
    expect(screen.getByText('Login Screen')).toBeOnTheScreen();
  });

  it('redirects authenticated users away from login', async () => {
    seedAuthState({ user: testUser, sessionToken: 'session-token' });
    const router = await renderApp('/login');

    await waitFor(() => expect(router.getPathname()).toBe('/home'));
    expect(screen.getByText('Home Screen')).toBeOnTheScreen();
  });

  it('redirects authenticated users away from onboarding', async () => {
    seedAuthState({ user: testUser, sessionToken: 'session-token' });
    const router = await renderApp('/onboarding');

    await waitFor(() => expect(router.getPathname()).toBe('/home'));
    expect(screen.getByText('Home Screen')).toBeOnTheScreen();
  });

  it('routes authenticated universal join links to the join screen with the invite code', async () => {
    seedAuthState({ user: testUser, sessionToken: 'session-token' });
    const router = await renderApp('/join/abc12');

    await waitFor(() => expect(router.getPathname()).toBe('/join-room'));
    expect(screen.getByText('Join Room Screen')).toBeOnTheScreen();
    expect(useGameStore.getState().pendingRoomCode).toBe('ABC12');
  });

  it('stores invite links before sending unauthenticated users to login', async () => {
    const router = await renderApp('/invite/xy789');

    await waitFor(() => expect(router.getPathname()).toBe('/login'));
    expect(screen.getByText('Login Screen')).toBeOnTheScreen();
    expect(useGameStore.getState().pendingRoomCode).toBe('XY789');
  });
});
