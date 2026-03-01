import { useState, useEffect, useCallback } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { api, setApiToken, onUnauthorized } from '../lib/api';
import {
  saveSessionToken, getSessionToken, clearUser,
  saveUser, getStoredUser,
} from '../lib/storage';
import type { UserProfile } from '../../../shared/types';

// Register the native Sign in with Apple plugin
interface SignInWithApplePlugin {
  signIn(): Promise<{ identityToken: string; givenName?: string; familyName?: string; error?: string; code?: string }>;
}

const SignInWithApple = Capacitor.isNativePlatform()
  ? registerPlugin<SignInWithApplePlugin>('SignInWithApple')
  : null;

interface UseAuthReturn {
  user: UserProfile | null;
  loading: boolean;
  isAuthenticated: boolean;
  signIn: () => Promise<{ needsUsername: boolean; tempToken?: string; suggestedName?: string; error?: string }>;
  completeRegistration: (tempToken: string, username: string, displayName: string, avatarId: string, avatarColor: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  updateUser: (updates: Partial<UserProfile>) => void;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Handle 401 from any API call - session expired
  useEffect(() => {
    onUnauthorized(() => {
      setUser(null);
      clearUser();
    });
  }, []);

  // On mount: check for existing session
  useEffect(() => {
    // Safety timeout: never hang on loading screen forever
    const timeout = setTimeout(() => setLoading(false), 5000);

    (async () => {
      try {
        const token = await getSessionToken();
        if (!token) {
          setLoading(false);
          clearTimeout(timeout);
          return;
        }

        setApiToken(token);

        // Try to refresh/validate
        const storedUser = await getStoredUser();
        if (storedUser) {
          setUser(storedUser);
        }

        // Validate with server
        try {
          const result = await api.refreshToken();
          setApiToken(result.sessionToken);
          await saveSessionToken(result.sessionToken);
          const profile: UserProfile = {
            id: result.user.id,
            username: result.user.username,
            displayName: result.user.displayName,
            avatarId: result.user.avatarId,
            avatarColor: result.user.avatarColor,
          };
          setUser(profile);
          await saveUser(profile);
        } catch (refreshErr: any) {
          // If refresh returns 401, the token is truly invalid — clear session
          if (refreshErr?.status === 401) {
            setApiToken(null);
            await clearUser();
            setUser(null);
          }
          // Otherwise (network error, timeout, etc.) keep the stored token —
          // it may still be valid for WebSocket auth
        }
      } catch {
        // Storage error
      } finally {
        setLoading(false);
        clearTimeout(timeout);
      }
    })();

    return () => clearTimeout(timeout);
  }, []);

  const signIn = useCallback(async (): Promise<{ needsUsername: boolean; tempToken?: string; suggestedName?: string; error?: string }> => {
    try {
      // Use native plugin on iOS, or return error on web
      if (!SignInWithApple) {
        return { needsUsername: false, error: 'Sign in with Apple is only available on iOS' };
      }

      const credential = await SignInWithApple.signIn();

      // Native plugin uses resolve() for errors (Swift 6 compat)
      if (credential.error) {
        const errorMsg = credential.error as string;
        if (credential.code === 'CANCELED' || errorMsg.includes('cancelled')) {
          return { needsUsername: false, error: undefined };
        }
        return { needsUsername: false, error: errorMsg };
      }

      const result = await api.authApple(
        credential.identityToken,
        credential.givenName,
        credential.familyName
      );

      if (!result.needsUsername && result.sessionToken && result.user) {
        // Returning user - complete sign in
        setApiToken(result.sessionToken);
        await saveSessionToken(result.sessionToken);
        const profile: UserProfile = {
          id: result.user.id,
          username: result.user.username,
          displayName: result.user.displayName,
          avatarId: result.user.avatarId,
          avatarColor: result.user.avatarColor,
        };
        setUser(profile);
        await saveUser(profile);
        return { needsUsername: false };
      }

      // New user - needs username
      return {
        needsUsername: true,
        tempToken: result.tempToken,
        suggestedName: result.suggestedName,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign in failed';
      if (message.includes('CANCELED') || message.includes('cancelled')) {
        return { needsUsername: false, error: undefined }; // User cancelled, not an error
      }
      return { needsUsername: false, error: message };
    }
  }, []);

  const completeRegistration = useCallback(async (
    tempToken: string,
    username: string,
    displayName: string,
    avatarId: string,
    avatarColor: string
  ): Promise<{ error?: string }> => {
    try {
      const result = await api.completeRegistration(tempToken, username, displayName, avatarId, avatarColor);

      setApiToken(result.sessionToken);
      await saveSessionToken(result.sessionToken);
      const profile: UserProfile = {
        id: result.user.id,
        username: result.user.username,
        displayName: result.user.displayName,
        avatarId: result.user.avatarId,
        avatarColor: result.user.avatarColor,
      };
      setUser(profile);
      await saveUser(profile);

      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Registration failed' };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.signOut();
    } catch {
      // Ignore - server might be unreachable
    }
    setApiToken(null);
    await clearUser();
    setUser(null);
  }, []);

  const updateUser = useCallback((updates: Partial<UserProfile>) => {
    setUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      saveUser(updated);
      return updated;
    });
  }, []);

  return {
    user,
    loading,
    isAuthenticated: !!user,
    signIn,
    completeRegistration,
    signOut,
    updateUser,
  };
}
