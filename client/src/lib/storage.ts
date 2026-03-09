/**
 * Secure session token storage using Capacitor Preferences.
 * Falls back to localStorage for web.
 */

import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

function getPreferences() {
  if (Capacitor.isNativePlatform()) {
    return Preferences;
  }
  return null;
}

const KEYS = {
  sessionToken: 'seq_session_token',
  roomSession: 'seq_room_session',
  userId: 'seq_user_id',
  username: 'seq_username',
  displayName: 'seq_display_name',
  avatarId: 'seq_avatar_id',
  avatarColor: 'seq_avatar_color',
} as const;

export async function saveSessionToken(token: string): Promise<void> {
  const prefs = getPreferences();
  if (prefs) {
    await prefs.set({ key: KEYS.sessionToken, value: token });
  } else {
    localStorage.setItem(KEYS.sessionToken, token);
  }
}

export async function getSessionToken(): Promise<string | null> {
  const prefs = getPreferences();
  if (prefs) {
    const { value } = await prefs.get({ key: KEYS.sessionToken });
    return value;
  }
  return localStorage.getItem(KEYS.sessionToken);
}

export async function clearSessionToken(): Promise<void> {
  const prefs = getPreferences();
  if (prefs) {
    await prefs.remove({ key: KEYS.sessionToken });
  } else {
    localStorage.removeItem(KEYS.sessionToken);
  }
}

export interface RoomSession {
  roomCode: string;
  token: string;
  playerId: string;
}

export async function saveRoomSession(session: RoomSession): Promise<void> {
  const prefs = getPreferences();
  const data = JSON.stringify(session);
  if (prefs) {
    await prefs.set({ key: KEYS.roomSession, value: data });
  } else {
    localStorage.setItem(KEYS.roomSession, data);
  }
}

export async function getRoomSession(): Promise<RoomSession | null> {
  const prefs = getPreferences();
  let data: string | null;
  if (prefs) {
    const { value } = await prefs.get({ key: KEYS.roomSession });
    data = value;
  } else {
    data = localStorage.getItem(KEYS.roomSession);
  }

  if (!data) return null;

  try {
    const parsed = JSON.parse(data) as Partial<RoomSession>;
    if (!parsed.roomCode || !parsed.token || !parsed.playerId) {
      return null;
    }
    return {
      roomCode: parsed.roomCode,
      token: parsed.token,
      playerId: parsed.playerId,
    };
  } catch {
    return null;
  }
}

export async function clearRoomSession(): Promise<void> {
  const prefs = getPreferences();
  if (prefs) {
    await prefs.remove({ key: KEYS.roomSession });
  } else {
    localStorage.removeItem(KEYS.roomSession);
  }
}

export interface StoredUser {
  id: string;
  username: string;
  displayName: string;
  avatarId: string;
  avatarColor: string;
}

export async function saveUser(user: StoredUser): Promise<void> {
  const prefs = getPreferences();
  const data = JSON.stringify(user);
  if (prefs) {
    await prefs.set({ key: 'seq_user', value: data });
  } else {
    localStorage.setItem('seq_user', data);
  }
}

export async function getStoredUser(): Promise<StoredUser | null> {
  const prefs = getPreferences();
  let data: string | null;
  if (prefs) {
    const { value } = await prefs.get({ key: 'seq_user' });
    data = value;
  } else {
    data = localStorage.getItem('seq_user');
  }
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function clearUser(): Promise<void> {
  const prefs = getPreferences();
  if (prefs) {
    await prefs.remove({ key: 'seq_user' });
    await prefs.remove({ key: KEYS.sessionToken });
  } else {
    localStorage.removeItem('seq_user');
    localStorage.removeItem(KEYS.sessionToken);
  }
}
