import { describe, it, expect, vi, beforeEach } from 'vitest';

// We need to mock the native modules before importing the store
vi.mock('expo-secure-store', () => ({
  setItemAsync: vi.fn(() => Promise.resolve()),
  getItemAsync: vi.fn(() => Promise.resolve(null)),
  deleteItemAsync: vi.fn(() => Promise.resolve()),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(() => Promise.resolve(null)),
    setItem: vi.fn(() => Promise.resolve()),
    removeItem: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock('@/services/auth', () => ({
  signInWithApple: vi.fn(),
  completeRegistration: vi.fn(),
  signOut: vi.fn(),
  restoreSession: vi.fn(() => Promise.resolve(null)),
  checkUsernameAvailability: vi.fn(() => Promise.resolve({ available: true, error: null })),
}));

describe('useAuthStore', () => {
  let useAuthStore: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Re-import to get fresh state
    const mod = await import('@/stores/authStore');
    useAuthStore = mod.useAuthStore;
    // Reset to initial state
    const store = useAuthStore.getState();
    store.clearError();
  });

  it('has correct initial state', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.sessionToken).toBeNull();
    expect(state.isLoading).toBe(true);
    expect(state.errorMessage).toBeNull();
    expect(state.needsUsername).toBe(false);
    expect(state.tempToken).toBeNull();
    expect(state.usernameAvailability).toEqual({ checking: false, available: null, error: null });
  });

  it('clearError clears errorMessage', () => {
    // Set an error state manually
    useAuthStore.setState({ errorMessage: 'Something went wrong' });
    expect(useAuthStore.getState().errorMessage).toBe('Something went wrong');

    useAuthStore.getState().clearError();
    expect(useAuthStore.getState().errorMessage).toBeNull();
  });

  it('setConnectionPhase updates phase', () => {
    useAuthStore.getState().setConnectionPhase('connecting');
    expect(useAuthStore.getState().connectionPhase).toBe('connecting');

    useAuthStore.getState().setConnectionPhase('attached');
    expect(useAuthStore.getState().connectionPhase).toBe('attached');

    useAuthStore.getState().setConnectionPhase('offline');
    expect(useAuthStore.getState().connectionPhase).toBe('offline');
  });
});