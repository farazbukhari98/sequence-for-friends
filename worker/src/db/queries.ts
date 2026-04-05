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
  impossible_bot_wins: number;
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
  game_variant: string;
  sequence_length: number;
  sequences_to_win: number;
  is_series_game: number;
  series_id: string | null;
  bot_difficulty: string | null;
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

interface HistoricalStatsRow {
  won: number;
  sequences_made: number;
  cards_played: number;
  two_eyed_used: number;
  one_eyed_used: number;
  dead_replaced: number;
  turns_taken: number;
  went_first: number;
  team_color: string;
  duration_ms: number;
  ended_at: number;
  bot_difficulty: string | null;
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

export async function searchUsersByPrefix(db: D1Database, prefix: string, limit = 20, currentUserId?: string): Promise<(DbUser & { friend_status?: string })[]> {
  if (currentUserId) {
    const result = await db.prepare(`
      SELECT u.*,
        CASE
          WHEN f_sent.status = 'accepted' THEN 'friend'
          WHEN f_sent.status = 'pending' THEN 'pending_sent'
          WHEN f_recv.status = 'pending' THEN 'pending_received'
          ELSE 'none'
        END AS friend_status
      FROM users u
      LEFT JOIN friends f_sent ON f_sent.user_id = ? AND f_sent.friend_id = u.id
      LEFT JOIN friends f_recv ON f_recv.user_id = u.id AND f_recv.friend_id = ?
      WHERE (u.username LIKE ? OR u.display_name LIKE ?)
        AND u.id != ?
      LIMIT ?
    `).bind(currentUserId, currentUserId, `${prefix}%`, `%${prefix}%`, currentUserId, limit).all();
    return result.results as any;
  }
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

function emptyUserStatsRow(userId: string, updatedAt: number): DbUserStats {
  return {
    user_id: userId,
    games_played: 0,
    games_won: 0,
    games_lost: 0,
    sequences_completed: 0,
    current_win_streak: 0,
    longest_win_streak: 0,
    games_by_team_color: '{}',
    cards_played: 0,
    two_eyed_jacks_used: 0,
    one_eyed_jacks_used: 0,
    dead_cards_replaced: 0,
    total_turns_taken: 0,
    first_move_games: 0,
    first_move_wins: 0,
    series_played: 0,
    series_won: 0,
    series_lost: 0,
    total_play_time_ms: 0,
    fastest_win_ms: null,
    impossible_bot_wins: 0,
    updated_at: updatedAt,
  };
}

function buildUserStatsRow(
  userId: string,
  rows: HistoricalStatsRow[],
  updatedAt: number
): DbUserStats {
  const stats = emptyUserStatsRow(userId, updatedAt);
  const gamesByTeamColor: Record<string, number> = {};

  for (const row of rows) {
    stats.games_played += 1;
    stats.games_won += row.won;
    stats.games_lost += row.won ? 0 : 1;
    stats.sequences_completed += row.sequences_made;
    stats.cards_played += row.cards_played;
    stats.two_eyed_jacks_used += row.two_eyed_used;
    stats.one_eyed_jacks_used += row.one_eyed_used;
    stats.dead_cards_replaced += row.dead_replaced;
    stats.total_turns_taken += row.turns_taken;
    stats.first_move_games += row.went_first;
    stats.first_move_wins += row.went_first && row.won ? 1 : 0;
    stats.total_play_time_ms += row.duration_ms;
    stats.impossible_bot_wins += row.bot_difficulty === 'impossible' && row.won ? 1 : 0;

    gamesByTeamColor[row.team_color] = (gamesByTeamColor[row.team_color] ?? 0) + 1;

    if (row.won) {
      stats.current_win_streak += 1;
      stats.longest_win_streak = Math.max(stats.longest_win_streak, stats.current_win_streak);
      if (stats.fastest_win_ms === null || row.duration_ms < stats.fastest_win_ms) {
        stats.fastest_win_ms = row.duration_ms;
      }
    } else {
      stats.current_win_streak = 0;
    }
  }

  stats.games_by_team_color = JSON.stringify(gamesByTeamColor);
  return stats;
}

async function ensureUserStatsRow(db: D1Database, userId: string): Promise<DbUserStats> {
  const existing = await db.prepare(
    'SELECT * FROM user_stats WHERE user_id = ?'
  ).bind(userId).first<DbUserStats>();
  if (existing) return existing;

  const history = await db.prepare(`
    SELECT
      gp.won,
      gp.sequences_made,
      gp.cards_played,
      gp.two_eyed_used,
      gp.one_eyed_used,
      gp.dead_replaced,
      gp.turns_taken,
      gp.went_first,
      gp.team_color,
      gh.duration_ms,
      gh.ended_at,
      gh.bot_difficulty
    FROM game_participants gp
    JOIN game_history gh ON gh.id = gp.game_id
    WHERE gp.user_id = ?
    ORDER BY gh.ended_at ASC, gh.id ASC
  `).bind(userId).all<HistoricalStatsRow>();

  const rebuilt = buildUserStatsRow(userId, history.results ?? [], Date.now());

  await db.prepare(`
    INSERT OR IGNORE INTO user_stats (
      user_id,
      games_played,
      games_won,
      games_lost,
      sequences_completed,
      current_win_streak,
      longest_win_streak,
      games_by_team_color,
      cards_played,
      two_eyed_jacks_used,
      one_eyed_jacks_used,
      dead_cards_replaced,
      total_turns_taken,
      first_move_games,
      first_move_wins,
      series_played,
      series_won,
      series_lost,
      total_play_time_ms,
      fastest_win_ms,
      impossible_bot_wins,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    rebuilt.user_id,
    rebuilt.games_played,
    rebuilt.games_won,
    rebuilt.games_lost,
    rebuilt.sequences_completed,
    rebuilt.current_win_streak,
    rebuilt.longest_win_streak,
    rebuilt.games_by_team_color,
    rebuilt.cards_played,
    rebuilt.two_eyed_jacks_used,
    rebuilt.one_eyed_jacks_used,
    rebuilt.dead_cards_replaced,
    rebuilt.total_turns_taken,
    rebuilt.first_move_games,
    rebuilt.first_move_wins,
    rebuilt.series_played,
    rebuilt.series_won,
    rebuilt.series_lost,
    rebuilt.total_play_time_ms,
    rebuilt.fastest_win_ms,
    rebuilt.impossible_bot_wins,
    rebuilt.updated_at
  ).run();

  return await db.prepare(
    'SELECT * FROM user_stats WHERE user_id = ?'
  ).bind(userId).first<DbUserStats>() ?? rebuilt;
}

export async function getUserStats(db: D1Database, userId: string): Promise<DbUserStats | null> {
  return ensureUserStatsRow(db, userId);
}

// ============================================
// GAME HISTORY QUERIES
// ============================================

export async function insertGameHistory(
  db: D1Database,
  game: DbGameHistory,
  participants: DbGameParticipant[]
): Promise<void> {
  for (const userId of new Set(participants.map(p => p.user_id))) {
    await ensureUserStatsRow(db, userId);
  }

  const stmts: D1PreparedStatement[] = [
    db.prepare(
      `INSERT INTO game_history (id, room_code, started_at, ended_at, duration_ms, player_count, team_count, winning_team_idx, was_stalemate, game_variant, sequence_length, sequences_to_win, is_series_game, series_id, bot_difficulty)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      game.id, game.room_code, game.started_at, game.ended_at, game.duration_ms,
      game.player_count, game.team_count, game.winning_team_idx, game.was_stalemate,
      game.game_variant, game.sequence_length, game.sequences_to_win, game.is_series_game,
      game.series_id, game.bot_difficulty
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
          impossible_bot_wins = impossible_bot_wins + CASE
            WHEN ? = 'impossible' AND ? = 1 THEN 1 ELSE 0
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
        game.bot_difficulty, // for impossible_bot_wins CASE
        p.won, // for impossible_bot_wins CASE
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
  offset = 0,
  filters?: { mode?: string; difficulty?: string; variant?: string; result?: string }
): Promise<{ games: (DbGameHistory & { participants: DbGameParticipant[] })[] }> {
  const whereClauses = ['gp.user_id = ?'];
  const binds: unknown[] = [userId];

  if (filters?.mode === 'bot') {
    whereClauses.push('gh.bot_difficulty IS NOT NULL');
  } else if (filters?.mode === 'multiplayer') {
    whereClauses.push('gh.bot_difficulty IS NULL');
  }

  if (filters?.difficulty) {
    whereClauses.push('gh.bot_difficulty = ?');
    binds.push(filters.difficulty);
  }

  if (filters?.variant) {
    whereClauses.push('gh.game_variant = ?');
    binds.push(filters.variant);
  }

  if (filters?.result === 'wins') {
    whereClauses.push('gp.won = 1');
  } else if (filters?.result === 'losses') {
    whereClauses.push('gp.won = 0');
  }

  binds.push(limit, offset);

  const games = await db.prepare(`
    SELECT gh.* FROM game_history gh
    INNER JOIN game_participants gp ON gh.id = gp.game_id
    WHERE ${whereClauses.join(' AND ')}
    ORDER BY gh.ended_at DESC
    LIMIT ? OFFSET ?
  `).bind(...binds).all<DbGameHistory>();

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
// DETAILED STATS QUERIES
// ============================================

interface ModeBreakdownRow {
  games_played: number;
  games_won: number;
  avg_duration_ms: number | null;
  fastest_win_ms: number | null;
  total_sequences: number;
  group_key: string | null;
}

export async function getDetailedStats(db: D1Database, userId: string): Promise<{
  botModes: ModeBreakdownRow[];
  multiplayer: ModeBreakdownRow[];
  variants: ModeBreakdownRow[];
  formats: ModeBreakdownRow[];
  favoriteColor: string | null;
  avgDuration: number | null;
  avgTurns: number | null;
  avgSequences: number | null;
}> {
  const [botModes, multiplayer, variants, formats, colorResult, insightsResult] = await db.batch([
    // Bot mode breakdown
    db.prepare(`
      SELECT gh.bot_difficulty AS group_key,
        COUNT(*) AS games_played,
        SUM(gp.won) AS games_won,
        AVG(gh.duration_ms) AS avg_duration_ms,
        MIN(CASE WHEN gp.won = 1 THEN gh.duration_ms END) AS fastest_win_ms,
        SUM(gp.sequences_made) AS total_sequences
      FROM game_history gh
      JOIN game_participants gp ON gh.id = gp.game_id AND gp.user_id = ?
      WHERE gh.bot_difficulty IS NOT NULL
      GROUP BY gh.bot_difficulty
    `).bind(userId),
    // Multiplayer breakdown
    db.prepare(`
      SELECT 'multiplayer' AS group_key,
        COUNT(*) AS games_played,
        SUM(gp.won) AS games_won,
        AVG(gh.duration_ms) AS avg_duration_ms,
        MIN(CASE WHEN gp.won = 1 THEN gh.duration_ms END) AS fastest_win_ms,
        SUM(gp.sequences_made) AS total_sequences
      FROM game_history gh
      JOIN game_participants gp ON gh.id = gp.game_id AND gp.user_id = ?
      WHERE gh.bot_difficulty IS NULL
    `).bind(userId),
    // Variant breakdown
    db.prepare(`
      SELECT gh.game_variant AS group_key,
        COUNT(*) AS games_played,
        SUM(gp.won) AS games_won,
        AVG(gh.duration_ms) AS avg_duration_ms,
        MIN(CASE WHEN gp.won = 1 THEN gh.duration_ms END) AS fastest_win_ms,
        SUM(gp.sequences_made) AS total_sequences
      FROM game_history gh
      JOIN game_participants gp ON gh.id = gp.game_id AND gp.user_id = ?
      GROUP BY gh.game_variant
    `).bind(userId),
    // Format breakdown (sequence length)
    db.prepare(`
      SELECT CAST(gh.sequence_length AS TEXT) AS group_key,
        COUNT(*) AS games_played,
        SUM(gp.won) AS games_won,
        AVG(gh.duration_ms) AS avg_duration_ms,
        MIN(CASE WHEN gp.won = 1 THEN gh.duration_ms END) AS fastest_win_ms,
        SUM(gp.sequences_made) AS total_sequences
      FROM game_history gh
      JOIN game_participants gp ON gh.id = gp.game_id AND gp.user_id = ?
      GROUP BY gh.sequence_length
    `).bind(userId),
    // Favorite team color
    db.prepare(`
      SELECT team_color AS group_key, COUNT(*) AS cnt
      FROM game_participants
      WHERE user_id = ?
      GROUP BY team_color
      ORDER BY cnt DESC
      LIMIT 1
    `).bind(userId),
    // Avg turns & sequences per game
    db.prepare(`
      SELECT AVG(gh.duration_ms) AS avg_duration_ms,
             AVG(gp.turns_taken) AS avg_turns,
             AVG(gp.sequences_made) AS avg_sequences
      FROM game_history gh
      JOIN game_participants gp ON gh.id = gp.game_id AND gp.user_id = ?
    `).bind(userId),
  ]);

  const colorRow = colorResult.results[0] as any;
  const insightsRow = insightsResult.results[0] as any;

  return {
    botModes: botModes.results as ModeBreakdownRow[],
    multiplayer: multiplayer.results as ModeBreakdownRow[],
    variants: variants.results as ModeBreakdownRow[],
    formats: formats.results as ModeBreakdownRow[],
    favoriteColor: colorRow?.group_key ?? null,
    avgDuration: insightsRow?.avg_duration_ms ?? null,
    avgTurns: insightsRow?.avg_turns ?? null,
    avgSequences: insightsRow?.avg_sequences ?? null,
  };
}

export async function getHeadToHead(db: D1Database, myUserId: string, theirUserId: string): Promise<{
  aggregates: { same_team_games: number; same_team_wins: number; opposite_games: number; opposite_my_wins: number; opposite_their_wins: number; total_games: number };
  recentGames: { game_id: string; ended_at: number; duration_ms: number; game_variant: string; bot_difficulty: string | null; was_stalemate: number; player_count: number; my_team: number; my_won: number; their_team: number; their_won: number; my_team_color: string }[];
}> {
  const [aggResult, recentResult] = await db.batch([
    // Aggregates over ALL shared games (no limit)
    db.prepare(`
      SELECT
        SUM(CASE WHEN me.team_index = them.team_index THEN 1 ELSE 0 END) AS same_team_games,
        SUM(CASE WHEN me.team_index = them.team_index AND me.won = 1 THEN 1 ELSE 0 END) AS same_team_wins,
        SUM(CASE WHEN me.team_index != them.team_index THEN 1 ELSE 0 END) AS opposite_games,
        SUM(CASE WHEN me.team_index != them.team_index AND me.won = 1 THEN 1 ELSE 0 END) AS opposite_my_wins,
        SUM(CASE WHEN me.team_index != them.team_index AND them.won = 1 THEN 1 ELSE 0 END) AS opposite_their_wins,
        COUNT(*) AS total_games
      FROM game_history gh
      JOIN game_participants me ON gh.id = me.game_id AND me.user_id = ?
      JOIN game_participants them ON gh.id = them.game_id AND them.user_id = ?
    `).bind(myUserId, theirUserId),
    // Recent 10 games for display
    db.prepare(`
      SELECT gh.id AS game_id, gh.ended_at, gh.duration_ms, gh.game_variant,
             gh.bot_difficulty, gh.was_stalemate, gh.player_count,
             me.team_index AS my_team, me.won AS my_won,
             them.team_index AS their_team, them.won AS their_won,
             me.team_color AS my_team_color
      FROM game_history gh
      JOIN game_participants me ON gh.id = me.game_id AND me.user_id = ?
      JOIN game_participants them ON gh.id = them.game_id AND them.user_id = ?
      ORDER BY gh.ended_at DESC
      LIMIT 10
    `).bind(myUserId, theirUserId),
  ]);

  const agg = (aggResult.results[0] ?? { same_team_games: 0, same_team_wins: 0, opposite_games: 0, opposite_my_wins: 0, opposite_their_wins: 0, total_games: 0 }) as any;

  return {
    aggregates: {
      same_team_games: agg.same_team_games ?? 0,
      same_team_wins: agg.same_team_wins ?? 0,
      opposite_games: agg.opposite_games ?? 0,
      opposite_my_wins: agg.opposite_my_wins ?? 0,
      opposite_their_wins: agg.opposite_their_wins ?? 0,
      total_games: agg.total_games ?? 0,
    },
    recentGames: recentResult.results as any,
  };
}

export async function getFriendCount(db: D1Database, userId: string): Promise<number> {
  const result = await db.prepare(
    'SELECT COUNT(*) AS cnt FROM friends WHERE user_id = ? AND status = ?'
  ).bind(userId, 'accepted').first<{ cnt: number }>();
  return result?.cnt ?? 0;
}

export async function getFriendStatus(db: D1Database, myUserId: string, theirUserId: string): Promise<string> {
  const [sent, recv] = await db.batch([
    db.prepare('SELECT status FROM friends WHERE user_id = ? AND friend_id = ?').bind(myUserId, theirUserId),
    db.prepare('SELECT status FROM friends WHERE user_id = ? AND friend_id = ?').bind(theirUserId, myUserId),
  ]);
  const sentRow = sent.results[0] as any;
  const recvRow = recv.results[0] as any;
  if (sentRow?.status === 'accepted') return 'friend';
  if (sentRow?.status === 'pending') return 'pending_sent';
  if (recvRow?.status === 'pending') return 'pending_received';
  return 'none';
}

// ============================================
// FRIENDS QUERIES
// ============================================

export async function getFriends(db: D1Database, userId: string): Promise<(DbFriend & { username: string; display_name: string; avatar_id: string; avatar_color: string; impossible_bot_wins: number })[]> {
  const result = await db.prepare(`
    SELECT f.*, u.username, u.display_name, u.avatar_id, u.avatar_color,
           COALESCE(s.impossible_bot_wins, 0) AS impossible_bot_wins
    FROM friends f
    INNER JOIN users u ON f.friend_id = u.id
    LEFT JOIN user_stats s ON f.friend_id = s.user_id
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
