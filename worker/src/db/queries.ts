/**
 * Typed D1 query helpers for users, stats, friends, game history, and invites.
 */

// ============================================
// TYPES
// ============================================

export interface DbUser {
  id: string;
  apple_sub: string;
  username: string;
  display_name: string;
  avatar_id: string;
  avatar_color: string;
  created_at: number;
  last_seen_at: number;
  apns_token: string | null;
}

export interface DbUserStats {
  user_id: string;
  games_played: number;
  games_won: number;
  games_lost: number;
  sequences_completed: number;
  current_win_streak: number;
  longest_win_streak: number;
  games_by_team_color: string; // JSON
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
  updated_at: number;
}

export interface DbGameHistory {
  id: string;
  room_code: string;
  started_at: number;
  ended_at: number;
  duration_ms: number;
  player_count: number;
  team_count: number;
  winning_team_idx: number | null;
  was_stalemate: number;
  sequence_length: number;
  sequences_to_win: number;
  is_series_game: number;
  series_id: string | null;
}

export interface DbGameParticipant {
  game_id: string;
  user_id: string;
  team_index: number;
  team_color: string;
  seat_index: number;
  won: number;
  turns_taken: number;
  cards_played: number;
  two_eyed_used: number;
  one_eyed_used: number;
  dead_replaced: number;
  sequences_made: number;
  went_first: number;
}

export interface DbFriend {
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted' | 'blocked';
  created_at: number;
  accepted_at: number | null;
}

export interface DbGameInvite {
  id: string;
  sender_id: string;
  recipient_id: string;
  room_code: string;
  status: 'pending' | 'accepted' | 'expired';
  created_at: number;
  expires_at: number;
}

// ============================================
// USER QUERIES
// ============================================

export async function getUserByAppleSub(db: D1Database, appleSub: string): Promise<DbUser | null> {
  return db.prepare('SELECT * FROM users WHERE apple_sub = ?').bind(appleSub).first<DbUser>();
}

export async function getUserById(db: D1Database, userId: string): Promise<DbUser | null> {
  return db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<DbUser>();
}

export async function getUserByUsername(db: D1Database, username: string): Promise<DbUser | null> {
  return db.prepare('SELECT * FROM users WHERE username = ?').bind(username).first<DbUser>();
}

export async function createUser(
  db: D1Database,
  id: string,
  appleSub: string,
  username: string,
  displayName: string,
  avatarId: string,
  avatarColor: string
): Promise<void> {
  const now = Date.now();
  await db.batch([
    db.prepare(
      'INSERT INTO users (id, apple_sub, username, display_name, avatar_id, avatar_color, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, appleSub, username, displayName, avatarId, avatarColor, now, now),
    db.prepare(
      'INSERT INTO user_stats (user_id, updated_at) VALUES (?, ?)'
    ).bind(id, now),
  ]);
}

export async function updateUserProfile(
  db: D1Database,
  userId: string,
  updates: { display_name?: string; avatar_id?: string; avatar_color?: string }
): Promise<void> {
  const setClauses: string[] = [];
  const values: unknown[] = [];

  if (updates.display_name !== undefined) {
    setClauses.push('display_name = ?');
    values.push(updates.display_name);
  }
  if (updates.avatar_id !== undefined) {
    setClauses.push('avatar_id = ?');
    values.push(updates.avatar_id);
  }
  if (updates.avatar_color !== undefined) {
    setClauses.push('avatar_color = ?');
    values.push(updates.avatar_color);
  }

  if (setClauses.length === 0) return;

  setClauses.push('last_seen_at = ?');
  values.push(Date.now());
  values.push(userId);

  await db.prepare(`UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`).bind(...values).run();
}

export async function updateApnsToken(db: D1Database, userId: string, apnsToken: string | null): Promise<void> {
  await db.prepare('UPDATE users SET apns_token = ? WHERE id = ?').bind(apnsToken, userId).run();
}

export async function deleteApnsToken(db: D1Database, token: string): Promise<void> {
  await db.prepare('UPDATE users SET apns_token = NULL WHERE apns_token = ?').bind(token).run();
}

export async function searchUsersByPrefix(db: D1Database, prefix: string, limit = 20): Promise<DbUser[]> {
  const result = await db.prepare(
    'SELECT * FROM users WHERE username LIKE ? LIMIT ?'
  ).bind(`${prefix}%`, limit).all<DbUser>();
  return result.results;
}

export async function updateLastSeen(db: D1Database, userId: string): Promise<void> {
  await db.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').bind(Date.now(), userId).run();
}

// ============================================
// STATS QUERIES
// ============================================

export async function getUserStats(db: D1Database, userId: string): Promise<DbUserStats | null> {
  return db.prepare('SELECT * FROM user_stats WHERE user_id = ?').bind(userId).first<DbUserStats>();
}

// ============================================
// GAME HISTORY QUERIES
// ============================================

export async function insertGameHistory(
  db: D1Database,
  game: DbGameHistory,
  participants: DbGameParticipant[]
): Promise<void> {
  const stmts: D1PreparedStatement[] = [
    db.prepare(
      `INSERT INTO game_history (id, room_code, started_at, ended_at, duration_ms, player_count, team_count, winning_team_idx, was_stalemate, sequence_length, sequences_to_win, is_series_game, series_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      game.id, game.room_code, game.started_at, game.ended_at, game.duration_ms,
      game.player_count, game.team_count, game.winning_team_idx, game.was_stalemate,
      game.sequence_length, game.sequences_to_win, game.is_series_game, game.series_id
    ),
  ];

  for (const p of participants) {
    stmts.push(
      db.prepare(
        `INSERT INTO game_participants (game_id, user_id, team_index, team_color, seat_index, won, turns_taken, cards_played, two_eyed_used, one_eyed_used, dead_replaced, sequences_made, went_first)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        p.game_id, p.user_id, p.team_index, p.team_color, p.seat_index, p.won,
        p.turns_taken, p.cards_played, p.two_eyed_used, p.one_eyed_used,
        p.dead_replaced, p.sequences_made, p.went_first
      )
    );
  }

  // Update each participant's aggregate stats
  for (const p of participants) {
    const durationMs = game.duration_ms;
    stmts.push(
      db.prepare(`
        UPDATE user_stats SET
          games_played = games_played + 1,
          games_won = games_won + ?,
          games_lost = games_lost + ?,
          sequences_completed = sequences_completed + ?,
          current_win_streak = CASE WHEN ? = 1 THEN current_win_streak + 1 ELSE 0 END,
          longest_win_streak = CASE
            WHEN ? = 1 AND current_win_streak + 1 > longest_win_streak
            THEN current_win_streak + 1
            ELSE longest_win_streak
          END,
          cards_played = cards_played + ?,
          two_eyed_jacks_used = two_eyed_jacks_used + ?,
          one_eyed_jacks_used = one_eyed_jacks_used + ?,
          dead_cards_replaced = dead_cards_replaced + ?,
          total_turns_taken = total_turns_taken + ?,
          first_move_games = first_move_games + ?,
          first_move_wins = first_move_wins + ?,
          total_play_time_ms = total_play_time_ms + ?,
          fastest_win_ms = CASE
            WHEN ? = 1 AND (fastest_win_ms IS NULL OR ? < fastest_win_ms)
            THEN ?
            ELSE fastest_win_ms
          END,
          updated_at = ?
        WHERE user_id = ?
      `).bind(
        p.won, // games_won increment
        p.won ? 0 : 1, // games_lost increment
        p.sequences_made,
        p.won, // for current_win_streak CASE
        p.won, // for longest_win_streak CASE
        p.cards_played,
        p.two_eyed_used,
        p.one_eyed_used,
        p.dead_replaced,
        p.turns_taken,
        p.went_first,
        p.went_first && p.won ? 1 : 0, // first_move_wins
        durationMs,
        p.won, // for fastest_win CASE condition
        durationMs, // for fastest_win comparison
        durationMs, // for fastest_win set value
        Date.now(),
        p.user_id
      )
    );
  }

  await db.batch(stmts);
}

export async function getGameHistory(
  db: D1Database,
  userId: string,
  limit = 20,
  offset = 0
): Promise<{ games: (DbGameHistory & { participants: DbGameParticipant[] })[] }> {
  const games = await db.prepare(`
    SELECT gh.* FROM game_history gh
    INNER JOIN game_participants gp ON gh.id = gp.game_id
    WHERE gp.user_id = ?
    ORDER BY gh.ended_at DESC
    LIMIT ? OFFSET ?
  `).bind(userId, limit, offset).all<DbGameHistory>();

  if (games.results.length === 0) {
    return { games: [] };
  }

  const gameIds = games.results.map(g => g.id);
  // Fetch participants for all games
  const placeholders = gameIds.map(() => '?').join(',');
  const allParticipants = await db.prepare(`
    SELECT gp.*, u.username, u.display_name, u.avatar_id, u.avatar_color
    FROM game_participants gp
    LEFT JOIN users u ON gp.user_id = u.id
    WHERE gp.game_id IN (${placeholders})
  `).bind(...gameIds).all<DbGameParticipant & { username?: string; display_name?: string }>();

  const participantsByGame = new Map<string, DbGameParticipant[]>();
  for (const p of allParticipants.results) {
    const list = participantsByGame.get(p.game_id) || [];
    list.push(p);
    participantsByGame.set(p.game_id, list);
  }

  return {
    games: games.results.map(g => ({
      ...g,
      participants: participantsByGame.get(g.id) || [],
    })),
  };
}

// ============================================
// FRIENDS QUERIES
// ============================================

export async function getFriends(db: D1Database, userId: string): Promise<(DbFriend & { username: string; display_name: string; avatar_id: string; avatar_color: string })[]> {
  const result = await db.prepare(`
    SELECT f.*, u.username, u.display_name, u.avatar_id, u.avatar_color
    FROM friends f
    INNER JOIN users u ON f.friend_id = u.id
    WHERE f.user_id = ? AND f.status = 'accepted'
    ORDER BY u.display_name ASC
  `).bind(userId).all();
  return result.results as any;
}

export async function getPendingFriendRequests(
  db: D1Database,
  userId: string
): Promise<(DbFriend & { username: string; display_name: string; avatar_id: string; avatar_color: string })[]> {
  const result = await db.prepare(`
    SELECT f.*, u.username, u.display_name, u.avatar_id, u.avatar_color
    FROM friends f
    INNER JOIN users u ON f.user_id = u.id
    WHERE f.friend_id = ? AND f.status = 'pending'
    ORDER BY f.created_at DESC
  `).bind(userId).all();
  return result.results as any;
}

export async function sendFriendRequest(db: D1Database, userId: string, friendId: string): Promise<void> {
  await db.prepare(
    'INSERT OR IGNORE INTO friends (user_id, friend_id, status, created_at) VALUES (?, ?, ?, ?)'
  ).bind(userId, friendId, 'pending', Date.now()).run();
}

export async function acceptFriendRequest(db: D1Database, userId: string, friendId: string): Promise<void> {
  const now = Date.now();
  await db.batch([
    // Update original request to accepted
    db.prepare(
      'UPDATE friends SET status = ?, accepted_at = ? WHERE user_id = ? AND friend_id = ?'
    ).bind('accepted', now, friendId, userId),
    // Create reverse friendship
    db.prepare(
      'INSERT OR REPLACE INTO friends (user_id, friend_id, status, created_at, accepted_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(userId, friendId, 'accepted', now, now),
  ]);
}

export async function rejectFriendRequest(db: D1Database, userId: string, friendId: string): Promise<void> {
  await db.prepare(
    'DELETE FROM friends WHERE user_id = ? AND friend_id = ? AND status = ?'
  ).bind(friendId, userId, 'pending').run();
}

export async function removeFriend(db: D1Database, userId: string, friendId: string): Promise<void> {
  await db.batch([
    db.prepare('DELETE FROM friends WHERE user_id = ? AND friend_id = ?').bind(userId, friendId),
    db.prepare('DELETE FROM friends WHERE user_id = ? AND friend_id = ?').bind(friendId, userId),
  ]);
}

export async function getFriendship(db: D1Database, userId: string, friendId: string): Promise<DbFriend | null> {
  return db.prepare(
    'SELECT * FROM friends WHERE user_id = ? AND friend_id = ?'
  ).bind(userId, friendId).first<DbFriend>();
}

// ============================================
// GAME INVITE QUERIES
// ============================================

export async function createGameInvite(
  db: D1Database,
  id: string,
  senderId: string,
  recipientId: string,
  roomCode: string
): Promise<void> {
  const now = Date.now();
  // Clean up expired invites opportunistically (batch delete)
  await db.prepare('DELETE FROM game_invites WHERE expires_at < ?').bind(now).run();
  await db.prepare(
    'INSERT INTO game_invites (id, sender_id, recipient_id, room_code, status, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, senderId, recipientId, roomCode, 'pending', now, now + 10 * 60 * 1000).run();
}
