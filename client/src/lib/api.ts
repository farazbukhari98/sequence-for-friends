/**
 * HTTP client wrapper for /api/* endpoints.
 * Auto-attaches Authorization header when session token is available.
 */

const PRODUCTION_API_URL = 'https://sequence-for-friends.farazbukhari98.workers.dev';

function getBaseUrl(): string {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // Capacitor on iOS/Android
  if (import.meta.env.PROD && window.location.hostname === 'localhost') {
    return PRODUCTION_API_URL;
  }
  // Production web
  if (import.meta.env.PROD) {
    return `${window.location.protocol}//${window.location.host}`;
  }
  // Dev mode
  return 'http://localhost:8787';
}

let sessionToken: string | null = null;
let onUnauthorizedCallback: (() => void) | null = null;

export function setApiToken(token: string | null): void {
  sessionToken = token;
}

export function getApiToken(): string | null {
  return sessionToken;
}

/** Register a callback for when a 401 response is received (expired token). */
export function onUnauthorized(cb: () => void): void {
  onUnauthorizedCallback = cb;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (sessionToken) {
    headers['Authorization'] = `Bearer ${sessionToken}`;
  }

  const response = await fetch(`${getBaseUrl()}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();

  if (!response.ok) {
    // On 401, clear token and notify auth hook (unless this is the refresh call itself)
    if (response.status === 401 && !path.includes('/auth/')) {
      sessionToken = null;
      onUnauthorizedCallback?.();
    }
    throw new ApiError(data.error || `Request failed (${response.status})`, response.status);
  }

  return data as T;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

// ============================================
// AUTH
// ============================================

export interface AuthAppleResponse {
  needsUsername: boolean;
  sessionToken?: string;
  tempToken?: string;
  suggestedName?: string;
  user?: {
    id: string;
    username: string;
    displayName: string;
    avatarId: string;
    avatarColor: string;
  };
}

export interface AuthCompleteResponse {
  sessionToken: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarId: string;
    avatarColor: string;
  };
}

export const api = {
  // Auth
  authApple: (identityToken: string, givenName?: string, familyName?: string) =>
    request<AuthAppleResponse>('POST', '/api/auth/apple', { identityToken, givenName, familyName }),

  completeRegistration: (tempToken: string, username: string, displayName: string, avatarId: string, avatarColor: string) =>
    request<AuthCompleteResponse>('POST', '/api/auth/complete-registration', { tempToken, username, displayName, avatarId, avatarColor }),

  refreshToken: () =>
    request<{ sessionToken: string; user: AuthCompleteResponse['user'] }>('POST', '/api/auth/refresh'),

  signOut: () =>
    request<{ success: boolean }>('DELETE', '/api/auth/session'),

  checkUsername: (username: string) =>
    request<{ available: boolean }>('GET', `/api/auth/check-username?username=${encodeURIComponent(username)}`),

  // Profile
  getMyProfile: () =>
    request<{ user: AuthCompleteResponse['user'] & { createdAt: number }; stats: any }>('GET', '/api/profile/me'),

  updateProfile: (updates: { displayName?: string; avatarId?: string; avatarColor?: string }) =>
    request<{ success: boolean }>('PATCH', '/api/profile/me', updates),

  searchProfiles: (query: string) =>
    request<{ results: { id: string; username: string; displayName: string; avatarId: string; avatarColor: string }[] }>('GET', `/api/profile/search?q=${encodeURIComponent(query)}`),

  getProfile: (username: string) =>
    request<{ user: AuthCompleteResponse['user'] & { createdAt: number }; stats: any }>('GET', `/api/profile/${username}`),

  // Friends
  getFriends: () =>
    request<{ friends: { userId: string; username: string; displayName: string; avatarId: string; avatarColor: string; since: number }[] }>('GET', '/api/friends'),

  getFriendRequests: () =>
    request<{ requests: { userId: string; username: string; displayName: string; avatarId: string; avatarColor: string; sentAt: number }[] }>('GET', '/api/friends/requests'),

  sendFriendRequest: (username: string) =>
    request<{ success: boolean; autoAccepted?: boolean }>('POST', '/api/friends/request', { username }),

  acceptFriend: (userId: string) =>
    request<{ success: boolean }>('POST', '/api/friends/accept', { userId }),

  rejectFriend: (userId: string) =>
    request<{ success: boolean }>('POST', '/api/friends/reject', { userId }),

  removeFriend: (userId: string) =>
    request<{ success: boolean }>('DELETE', `/api/friends/${userId}`),

  // Stats
  getMyStats: () =>
    request<{ stats: any }>('GET', '/api/stats/me'),

  getMyHistory: (limit = 20, offset = 0) =>
    request<{ games: any[] }>('GET', `/api/stats/me/history?limit=${limit}&offset=${offset}`),

  getUserStats: (username: string) =>
    request<{ stats: any }>('GET', `/api/stats/${username}`),

  // Push
  registerPush: (token: string) =>
    request<{ success: boolean }>('POST', '/api/push/register', { token }),

  // Invites
  inviteFriend: (friendId: string, roomCode: string) =>
    request<{ success: boolean; inviteId: string }>('POST', '/api/invite', { friendId, roomCode }),
};
