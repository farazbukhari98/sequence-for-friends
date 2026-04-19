import * as AppleAuthentication from 'expo-apple-authentication';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import type { UserProfile, ConnectionPhase } from '@/types/game';

const SESSION_TOKEN_KEY = 'sequence_session_token';
const USER_PROFILE_KEY = 'sequence_user_profile';
const ROOM_SESSION_KEY = 'sequence_room_session';

export async function signInWithApple(): Promise<{
  needsUsername: boolean;
  sessionToken?: string;
  tempToken?: string;
  suggestedName?: string;
  user?: UserProfile;
}> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    const { identityToken, fullName } = credential;
    if (!identityToken) throw new Error('No identity token received');

    const fullNameObj = fullName
      ? { givenName: fullName.givenName ?? undefined, familyName: fullName.familyName ?? undefined }
      : undefined;

    const response = await api.authApple(identityToken, fullNameObj);

    if (!response.needsUsername && response.sessionToken && response.user) {
      // Auto-login — save session
      await saveSession(response.sessionToken, response.user);
      return { needsUsername: false, sessionToken: response.sessionToken, user: response.user };
    }

    return {
      needsUsername: true,
      tempToken: response.tempToken!,
      suggestedName: response.suggestedName,
    };
  } catch (error: any) {
    if (error.code === 'ERR_CANCELED') {
      throw new Error('Sign in canceled');
    }
    throw error;
  }
}

export async function completeRegistration(
  tempToken: string,
  username: string,
  displayName: string,
  avatarId: string,
  avatarColor: string
): Promise<{ sessionToken: string; user: UserProfile }> {
  const response = await api.authComplete(tempToken, username, displayName, avatarId, avatarColor);
  await saveSession(response.sessionToken, response.user);
  return response;
}

export async function signOut(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
  await AsyncStorage.removeItem(USER_PROFILE_KEY);
  await AsyncStorage.removeItem(ROOM_SESSION_KEY);
}

export async function getSessionToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function getUser(): Promise<UserProfile | null> {
  try {
    const json = await AsyncStorage.getItem(USER_PROFILE_KEY);
    return json ? JSON.parse(json) : null;
  } catch {
    return null;
  }
}

export async function saveSession(token: string, user: UserProfile): Promise<void> {
  await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
  await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(user));
}

export async function restoreSession(): Promise<{ token: string; user: UserProfile } | null> {
  const token = await getSessionToken();
  const user = await getUser();
  if (!token || !user) return null;

  // Verify session is still valid
  try {
    const profile = await api.getProfile(token);
    await saveSession(token, profile.user);
    return { token, user: profile.user };
  } catch {
    // Session expired
    await signOut();
    return null;
  }
}

export async function checkUsernameAvailability(username: string): Promise<{ available: boolean; error?: string }> {
  try {
    return await api.checkUsername(username);
  } catch {
    return { available: false, error: 'Failed to check username' };
  }
}