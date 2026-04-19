import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UserProfile, ConnectionPhase } from '@/types/game';
import { signInWithApple, completeRegistration, signOut as authSignOut, restoreSession, checkUsernameAvailability } from '@/services/auth';

interface AuthState {
  user: UserProfile | null;
  sessionToken: string | null;
  connectionPhase: ConnectionPhase;
  errorMessage: string | null;
  isLoading: boolean;
  needsUsername: boolean;
  tempToken: string | null;
  suggestedName: string | null;
  usernameAvailability: { checking: boolean; available: boolean | null; error: string | null };

  // Actions
  signIn: () => Promise<void>;
  completeRegistration: (username: string, displayName: string, avatarId: string, avatarColor: string) => Promise<void>;
  signOut: () => Promise<void>;
  restoreSession: () => Promise<void>;
  checkUsername: (username: string) => Promise<void>;
  clearError: () => void;
  setConnectionPhase: (phase: ConnectionPhase) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  sessionToken: null,
  connectionPhase: 'idle',
  errorMessage: null,
  isLoading: false,
  needsUsername: false,
  tempToken: null,
  suggestedName: null,
  usernameAvailability: { checking: false, available: null, error: null },

  signIn: async () => {
    set({ isLoading: true, errorMessage: null });
    try {
      const result = await signInWithApple();
      if (result.needsUsername) {
        set({
          needsUsername: true,
          tempToken: result.tempToken!,
          suggestedName: result.suggestedName ?? null,
          isLoading: false,
        });
      } else {
        set({
          user: result.user!,
          sessionToken: result.sessionToken!,
          isLoading: false,
          needsUsername: false,
        });
      }
    } catch (error: any) {
      set({ errorMessage: error.message, isLoading: false });
    }
  },

  completeRegistration: async (username, displayName, avatarId, avatarColor) => {
    const { tempToken } = get();
    if (!tempToken) return;

    set({ isLoading: true, errorMessage: null });
    try {
      const result = await completeRegistration(tempToken, username, displayName, avatarId, avatarColor);
      set({
        user: result.user,
        sessionToken: result.sessionToken,
        isLoading: false,
        needsUsername: false,
        tempToken: null,
        suggestedName: null,
      });
    } catch (error: any) {
      set({ errorMessage: error.message, isLoading: false });
    }
  },

  signOut: async () => {
    await authSignOut();
    set({
      user: null,
      sessionToken: null,
      needsUsername: false,
      tempToken: null,
      suggestedName: null,
      errorMessage: null,
    });
  },

  restoreSession: async () => {
    set({ isLoading: true, errorMessage: null });
    try {
      const session = await restoreSession();
      if (session) {
        set({ user: session.user, sessionToken: session.token, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  checkUsername: async (username: string) => {
    set({ usernameAvailability: { checking: true, available: null, error: null } });
    try {
      const result = await checkUsernameAvailability(username);
      set({ usernameAvailability: { checking: false, available: result.available, error: result.error ?? null } });
    } catch {
      set({ usernameAvailability: { checking: false, available: null, error: 'Failed to check' } });
    }
  },

  clearError: () => set({ errorMessage: null }),
  setConnectionPhase: (phase) => set({ connectionPhase: phase }),
}));