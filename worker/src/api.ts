import type { Env } from './index.js';
import { verifyAppleIdentityToken, createSessionToken, verifySessionToken } from './auth.js';
import { authenticate, requireAuth } from './middleware.js';
import {
  getUserByAppleSub, getUserById, getUserByUsername, createUser,
  updateUserProfile, updateApnsToken, deleteApnsToken, searchUsersByPrefix, updateLastSeen,
  getUserStats, getGameHistory,
  getFriends, getPendingFriendRequests, sendFriendRequest,
  acceptFriendRequest, rejectFriendRequest, removeFriend, getFriendship,
  createGameInvite,
} from './db/queries.js';
import { sendPushNotification } from './apns.js';

// ============================================
// HELPERS
// ============================================

// Valid avatar IDs and colors — must match client/src/lib/avatars.ts
const VALID_AVATAR_IDS = new Set([
  'bear', 'fox', 'cat', 'dog', 'owl', 'unicorn', 'dragon', 'octopus',
  'penguin', 'koala', 'lion', 'wolf', 'eagle', 'rabbit', 'panda', 'alien',
]);
const VALID_AVATAR_COLORS = new Set([
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
]);

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function corsHeaders(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}

// Pending registrations are stored in KV (PLAYER_TOKENS namespace with "reg:" prefix)
// to survive across Worker isolates.

// ============================================
// RATE LIMITING
// ============================================

async function checkRateLimit(env: Env, key: string, maxRequests: number, windowSecs: number): Promise<boolean> {
  const rlKey = `rl:${key}`;
  const current = parseInt(await env.PLAYER_TOKENS.get(rlKey) || '0');
  if (current >= maxRequests) return false;
  await env.PLAYER_TOKENS.put(rlKey, String(current + 1), { expirationTtl: windowSecs });
  return true;
}

// ============================================
// ROUTE DISPATCHER
// ============================================

export async function handleApiRequest(request: Request, env: Env, path: string): Promise<Response> {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return corsHeaders();
  }

  try {
    // ========== AUTH ==========
    if (path === '/api/auth/apple' && request.method === 'POST') {
      return handleAppleAuth(request, env);
    }
    if (path === '/api/auth/complete-registration' && request.method === 'POST') {
      return handleCompleteRegistration(request, env);
    }
    if (path === '/api/auth/refresh' && request.method === 'POST') {
      return handleRefreshToken(request, env);
    }
    if (path === '/api/auth/session' && request.method === 'DELETE') {
      return handleSignOut(request, env);
    }
    if (path === '/api/auth/check-username' && request.method === 'GET') {
      return handleCheckUsername(request, env);
    }

    // ========== PROFILE ==========
    if (path === '/api/profile/me' && request.method === 'GET') {
      return handleGetMyProfile(request, env);
    }
    if (path === '/api/profile/me' && request.method === 'PATCH') {
      return handleUpdateMyProfile(request, env);
    }
    if (path === '/api/profile/search' && request.method === 'GET') {
      return handleSearchProfiles(request, env);
    }
    if (path.startsWith('/api/profile/') && request.method === 'GET') {
      const username = path.slice('/api/profile/'.length);
      return handleGetProfile(username, env);
    }

    // ========== FRIENDS ==========
    if (path === '/api/friends' && request.method === 'GET') {
      return handleGetFriends(request, env);
    }
    if (path === '/api/friends/requests' && request.method === 'GET') {
      return handleGetFriendRequests(request, env);
    }
    if (path === '/api/friends/request' && request.method === 'POST') {
      return handleSendFriendRequest(request, env);
    }
    if (path === '/api/friends/accept' && request.method === 'POST') {
      return handleAcceptFriend(request, env);
    }
    if (path === '/api/friends/reject' && request.method === 'POST') {
      return handleRejectFriend(request, env);
    }
    if (path.startsWith('/api/friends/') && request.method === 'DELETE') {
      const userId = path.slice('/api/friends/'.length);
      return handleRemoveFriend(request, env, userId);
    }

    // ========== STATS ==========
    if (path === '/api/stats/me' && request.method === 'GET') {
      return handleGetMyStats(request, env);
    }
    if (path === '/api/stats/me/history' && request.method === 'GET') {
      return handleGetMyHistory(request, env);
    }
    if (path.startsWith('/api/stats/') && request.method === 'GET') {
      const username = path.slice('/api/stats/'.length);
      return handleGetUserStats(username, env);
    }

    // ========== PUSH & INVITES ==========
    if (path === '/api/push/register' && request.method === 'POST') {
      return handleRegisterPush(request, env);
    }
    if (path === '/api/invite' && request.method === 'POST') {
      return handleInvite(request, env);
    }

    return json({ error: 'Not found' }, 404);
  } catch (err) {
    console.error('API error:', err);
    return json({ error: 'Internal server error' }, 500);
  }
}

// ============================================
// AUTH HANDLERS
// ============================================

async function handleAppleAuth(request: Request, env: Env): Promise<Response> {
  // Rate limit: 10 per minute per IP
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (!await checkRateLimit(env, `auth:${ip}`, 10, 60)) {
    return json({ error: 'Too many requests. Please try again later.' }, 429);
  }

  const body = await request.json() as { identityToken: string; givenName?: string; familyName?: string };

  if (!body.identityToken) {
    return json({ error: 'Missing identityToken' }, 400);
  }

  const applePayload = await verifyAppleIdentityToken(body.identityToken, env);

  // Check if user exists
  const existingUser = await getUserByAppleSub(env.DB, applePayload.sub);

  if (existingUser) {
    // Returning user - issue session token
    await updateLastSeen(env.DB, existingUser.id);
    const sessionToken = await createSessionToken(existingUser.id, existingUser.username, env.AUTH_SECRET);
    return json({
      needsUsername: false,
      sessionToken,
      user: {
        id: existingUser.id,
        username: existingUser.username,
        displayName: existingUser.display_name,
        avatarId: existingUser.avatar_id,
        avatarColor: existingUser.avatar_color,
      },
    });
  }

  // New user - needs username registration
  const tempToken = crypto.randomUUID();
  await env.PLAYER_TOKENS.put(
    `reg:${tempToken}`,
    JSON.stringify({ appleSub: applePayload.sub, givenName: body.givenName, familyName: body.familyName }),
    { expirationTtl: 600 } // 10 minutes
  );

  return json({
    needsUsername: true,
    tempToken,
    suggestedName: body.givenName || undefined,
  });
}

async function handleCompleteRegistration(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as {
    tempToken: string;
    username: string;
    displayName: string;
    avatarId: string;
    avatarColor: string;
  };

  if (!body.tempToken || !body.username || !body.displayName) {
    return json({ error: 'Missing required fields' }, 400);
  }

  // Validate username
  const username = body.username.toLowerCase().trim();
  if (username.length < 3 || username.length > 20) {
    return json({ error: 'Username must be 3-20 characters' }, 400);
  }
  if (!/^[a-z0-9_]+$/.test(username)) {
    return json({ error: 'Username can only contain lowercase letters, numbers, and underscores' }, 400);
  }

  // Verify temp token from KV
  const pendingJson = await env.PLAYER_TOKENS.get(`reg:${body.tempToken}`);
  if (!pendingJson) {
    return json({ error: 'Registration expired. Please sign in again.' }, 400);
  }
  const pending = JSON.parse(pendingJson) as { appleSub: string; givenName?: string; familyName?: string };
  await env.PLAYER_TOKENS.delete(`reg:${body.tempToken}`);

  // Check username uniqueness
  const existing = await getUserByUsername(env.DB, username);
  if (existing) {
    return json({ error: 'Username already taken' }, 409);
  }

  // Validate avatar fields
  const avatarId = body.avatarId && VALID_AVATAR_IDS.has(body.avatarId) ? body.avatarId : 'bear';
  const avatarColor = body.avatarColor && VALID_AVATAR_COLORS.has(body.avatarColor) ? body.avatarColor : '#6366f1';

  // Create user
  const userId = crypto.randomUUID();
  await createUser(
    env.DB, userId, pending.appleSub, username,
    body.displayName.trim(), avatarId, avatarColor
  );

  const sessionToken = await createSessionToken(userId, username, env.AUTH_SECRET);

  return json({
    sessionToken,
    user: {
      id: userId,
      username,
      displayName: body.displayName.trim(),
      avatarId,
      avatarColor,
    },
  });
}

async function handleRefreshToken(request: Request, env: Env): Promise<Response> {
  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) return authResult;

  const user = await getUserById(env.DB, authResult.userId);
  if (!user) {
    return json({ error: 'User not found' }, 404);
  }

  await updateLastSeen(env.DB, user.id);
  const sessionToken = await createSessionToken(user.id, user.username, env.AUTH_SECRET);

  return json({
    sessionToken,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      avatarId: user.avatar_id,
      avatarColor: user.avatar_color,
    },
  });
}

async function handleSignOut(request: Request, env: Env): Promise<Response> {
  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) return authResult;

  // Clear APNs token
  await updateApnsToken(env.DB, authResult.userId, null);

  return json({ success: true });
}

async function handleCheckUsername(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const username = (url.searchParams.get('username') || '').toLowerCase().trim();
  if (!username || username.length < 3) {
    return json({ available: false, error: 'Username too short' });
  }
  const existing = await getUserByUsername(env.DB, username);
  return json({ available: !existing });
}

// ============================================
// PROFILE HANDLERS
// ============================================

async function handleGetMyProfile(request: Request, env: Env): Promise<Response> {
  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) return authResult;

  const user = await getUserById(env.DB, authResult.userId);
  if (!user) return json({ error: 'User not found' }, 404);

  const stats = await getUserStats(env.DB, authResult.userId);

  return json({
    user: {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      avatarId: user.avatar_id,
      avatarColor: user.avatar_color,
      createdAt: user.created_at,
    },
    stats: stats ? formatStats(stats) : emptyStats(),
  });
}

async function handleUpdateMyProfile(request: Request, env: Env): Promise<Response> {
  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) return authResult;

  const body = await request.json() as { displayName?: string; avatarId?: string; avatarColor?: string };

  const updates: { display_name?: string; avatar_id?: string; avatar_color?: string } = {};
  if (body.displayName !== undefined) {
    const name = body.displayName.trim();
    if (name.length < 1 || name.length > 30) {
      return json({ error: 'Display name must be 1-30 characters' }, 400);
    }
    updates.display_name = name;
  }
  if (body.avatarId !== undefined) {
    if (!VALID_AVATAR_IDS.has(body.avatarId)) {
      return json({ error: 'Invalid avatar' }, 400);
    }
    updates.avatar_id = body.avatarId;
  }
  if (body.avatarColor !== undefined) {
    if (!VALID_AVATAR_COLORS.has(body.avatarColor)) {
      return json({ error: 'Invalid avatar color' }, 400);
    }
    updates.avatar_color = body.avatarColor;
  }

  await updateUserProfile(env.DB, authResult.userId, updates);

  return json({ success: true });
}

async function handleSearchProfiles(request: Request, env: Env): Promise<Response> {
  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) return authResult;

  const url = new URL(request.url);
  const query = url.searchParams.get('q') || '';
  if (query.length < 2) {
    return json({ results: [] });
  }

  const users = await searchUsersByPrefix(env.DB, query.toLowerCase(), 20);

  return json({
    results: users
      .filter(u => u.id !== authResult.userId)
      .map(u => ({
        id: u.id,
        username: u.username,
        displayName: u.display_name,
        avatarId: u.avatar_id,
        avatarColor: u.avatar_color,
      })),
  });
}

async function handleGetProfile(username: string, env: Env): Promise<Response> {
  const user = await getUserByUsername(env.DB, username.toLowerCase());
  if (!user) return json({ error: 'User not found' }, 404);

  const stats = await getUserStats(env.DB, user.id);

  return json({
    user: {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      avatarId: user.avatar_id,
      avatarColor: user.avatar_color,
      createdAt: user.created_at,
    },
    stats: stats ? formatStats(stats) : emptyStats(),
  });
}

// ============================================
// FRIENDS HANDLERS
// ============================================

async function handleGetFriends(request: Request, env: Env): Promise<Response> {
  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) return authResult;

  const friends = await getFriends(env.DB, authResult.userId);

  return json({
    friends: friends.map(f => ({
      userId: f.friend_id,
      username: f.username,
      displayName: f.display_name,
      avatarId: f.avatar_id,
      avatarColor: f.avatar_color,
      since: f.accepted_at,
      hasBeatImpossibleBot: (f as any).impossible_bot_wins > 0,
    })),
  });
}

async function handleGetFriendRequests(request: Request, env: Env): Promise<Response> {
  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) return authResult;

  const requests = await getPendingFriendRequests(env.DB, authResult.userId);

  return json({
    requests: requests.map(r => ({
      userId: r.user_id,
      username: r.username,
      displayName: r.display_name,
      avatarId: r.avatar_id,
      avatarColor: r.avatar_color,
      sentAt: r.created_at,
    })),
  });
}

async function handleSendFriendRequest(request: Request, env: Env): Promise<Response> {
  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) return authResult;

  // Rate limit: 20 per minute per user
  if (!await checkRateLimit(env, `fr:${authResult.userId}`, 20, 60)) {
    return json({ error: 'Too many requests. Please try again later.' }, 429);
  }

  const body = await request.json() as { username: string };
  if (!body.username) return json({ error: 'Missing username' }, 400);

  const friend = await getUserByUsername(env.DB, body.username.toLowerCase());
  if (!friend) return json({ error: 'User not found' }, 404);

  if (friend.id === authResult.userId) {
    return json({ error: 'Cannot add yourself' }, 400);
  }

  // Check if friendship already exists
  const existing = await getFriendship(env.DB, authResult.userId, friend.id);
  if (existing) {
    if (existing.status === 'accepted') return json({ error: 'Already friends' }, 400);
    if (existing.status === 'pending') return json({ error: 'Request already sent' }, 400);
    if (existing.status === 'blocked') return json({ error: 'User not found' }, 404);
  }

  // Check if they already sent us a request (or blocked us)
  const reverse = await getFriendship(env.DB, friend.id, authResult.userId);
  if (reverse?.status === 'blocked') {
    return json({ error: 'User not found' }, 404); // Don't reveal block
  }
  if (reverse?.status === 'pending') {
    // Auto-accept
    await acceptFriendRequest(env.DB, authResult.userId, friend.id);
    return json({ success: true, autoAccepted: true });
  }

  await sendFriendRequest(env.DB, authResult.userId, friend.id);

  return json({ success: true });
}

async function handleAcceptFriend(request: Request, env: Env): Promise<Response> {
  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) return authResult;

  const body = await request.json() as { userId: string };
  if (!body.userId) return json({ error: 'Missing userId' }, 400);

  await acceptFriendRequest(env.DB, authResult.userId, body.userId);

  return json({ success: true });
}

async function handleRejectFriend(request: Request, env: Env): Promise<Response> {
  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) return authResult;

  const body = await request.json() as { userId: string };
  if (!body.userId) return json({ error: 'Missing userId' }, 400);

  await rejectFriendRequest(env.DB, authResult.userId, body.userId);

  return json({ success: true });
}

async function handleRemoveFriend(request: Request, env: Env, friendUserId: string): Promise<Response> {
  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) return authResult;

  await removeFriend(env.DB, authResult.userId, friendUserId);

  return json({ success: true });
}

// ============================================
// STATS HANDLERS
// ============================================

async function handleGetMyStats(request: Request, env: Env): Promise<Response> {
  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) return authResult;

  const stats = await getUserStats(env.DB, authResult.userId);

  return json({ stats: stats ? formatStats(stats) : emptyStats() });
}

async function handleGetMyHistory(request: Request, env: Env): Promise<Response> {
  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) return authResult;

  const url = new URL(request.url);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '20') || 0, 1), 50);
  const offset = Math.min(Math.max(parseInt(url.searchParams.get('offset') || '0') || 0, 0), 10000);

  const history = await getGameHistory(env.DB, authResult.userId, limit, offset);

  return json(history);
}

async function handleGetUserStats(username: string, env: Env): Promise<Response> {
  const user = await getUserByUsername(env.DB, username.toLowerCase());
  if (!user) return json({ error: 'User not found' }, 404);

  const stats = await getUserStats(env.DB, user.id);

  return json({ stats: stats ? formatStats(stats) : emptyStats() });
}

// ============================================
// PUSH & INVITE HANDLERS
// ============================================

async function handleRegisterPush(request: Request, env: Env): Promise<Response> {
  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) return authResult;

  const body = await request.json() as { token: string };
  if (!body.token) return json({ error: 'Missing token' }, 400);

  await updateApnsToken(env.DB, authResult.userId, body.token);

  return json({ success: true });
}

async function handleInvite(request: Request, env: Env): Promise<Response> {
  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) return authResult;

  // Rate limit: 10 per minute per user
  if (!await checkRateLimit(env, `inv:${authResult.userId}`, 10, 60)) {
    return json({ error: 'Too many requests. Please try again later.' }, 429);
  }

  const body = await request.json() as { friendId: string; roomCode: string };
  if (!body.friendId || !body.roomCode) {
    return json({ error: 'Missing friendId or roomCode' }, 400);
  }

  // Validate friendId format (UUID)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.friendId)) {
    return json({ error: 'Invalid friendId' }, 400);
  }

  // Validate room code format
  if (!/^[A-Z0-9]{5}$/i.test(body.roomCode)) {
    return json({ error: 'Invalid room code' }, 400);
  }

  // Verify friendship
  const friendship = await getFriendship(env.DB, authResult.userId, body.friendId);
  if (!friendship || friendship.status !== 'accepted') {
    return json({ error: 'Not friends with this user' }, 403);
  }

  // Get friend's APNs token
  const friend = await getUserById(env.DB, body.friendId);
  if (!friend) return json({ error: 'User not found' }, 404);

  // Get sender info
  const sender = await getUserById(env.DB, authResult.userId);

  // Create invite record
  const inviteId = crypto.randomUUID();
  await createGameInvite(env.DB, inviteId, authResult.userId, body.friendId, body.roomCode);

  // Send push notification if token exists
  if (friend.apns_token) {
    const result = await sendPushNotification(
      friend.apns_token,
      {
        alert: {
          title: 'Game Invite',
          body: `${sender?.display_name || 'A friend'} invited you to play Sequence!`,
        },
        sound: 'default',
        data: {
          type: 'game_invite',
          roomCode: body.roomCode,
          inviteId,
        },
      },
      env
    );

    // Clean up stale APNs token
    if (result.staleToken) {
      await deleteApnsToken(env.DB, friend.apns_token);
    }
  }

  return json({ success: true, inviteId });
}

// ============================================
// HELPERS
// ============================================

function emptyStats() {
  return {
    gamesPlayed: 0, gamesWon: 0, gamesLost: 0, winRate: 0,
    sequencesCompleted: 0, currentWinStreak: 0, longestWinStreak: 0,
    gamesByTeamColor: {}, cardsPlayed: 0, twoEyedJacksUsed: 0,
    oneEyedJacksUsed: 0, deadCardsReplaced: 0, totalTurnsTaken: 0,
    firstMoveGames: 0, firstMoveWins: 0, seriesPlayed: 0,
    seriesWon: 0, seriesLost: 0, totalPlayTimeMs: 0, fastestWinMs: null,
    impossibleBotWins: 0, hasBeatImpossibleBot: false,
  };
}

interface DbStats {
  games_played: number;
  games_won: number;
  games_lost: number;
  sequences_completed: number;
  current_win_streak: number;
  longest_win_streak: number;
  games_by_team_color: string;
  cards_played: number;
  two_eyed_jacks_used: number;
  one_eyed_jacks_used: number;
  dead_cards_replaced: number;
  total_turns_taken: number;
  first_move_games: number;
  first_move_wins: number;
  series_played: number;
  series_won: number;
  series_lost: number;
  total_play_time_ms: number;
  fastest_win_ms: number | null;
  impossible_bot_wins: number;
}

function formatStats(stats: DbStats) {
  return {
    gamesPlayed: stats.games_played,
    gamesWon: stats.games_won,
    gamesLost: stats.games_lost,
    winRate: stats.games_played > 0 ? Math.round((stats.games_won / stats.games_played) * 100) : 0,
    sequencesCompleted: stats.sequences_completed,
    currentWinStreak: stats.current_win_streak,
    longestWinStreak: stats.longest_win_streak,
    gamesByTeamColor: JSON.parse(stats.games_by_team_color || '{}'),
    cardsPlayed: stats.cards_played,
    twoEyedJacksUsed: stats.two_eyed_jacks_used,
    oneEyedJacksUsed: stats.one_eyed_jacks_used,
    deadCardsReplaced: stats.dead_cards_replaced,
    totalTurnsTaken: stats.total_turns_taken,
    firstMoveGames: stats.first_move_games,
    firstMoveWins: stats.first_move_wins,
    seriesPlayed: stats.series_played,
    seriesWon: stats.series_won,
    seriesLost: stats.series_lost,
    totalPlayTimeMs: stats.total_play_time_ms,
    fastestWinMs: stats.fastest_win_ms,
    impossibleBotWins: stats.impossible_bot_wins || 0,
    hasBeatImpossibleBot: (stats.impossible_bot_wins || 0) > 0,
  };
}
