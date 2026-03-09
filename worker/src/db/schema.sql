-- Sequence for Friends - D1 Database Schema
-- Migration v1: Users, Stats, Game History, Friends, Invites

-- ============================================
-- USERS
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  apple_sub TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_id TEXT NOT NULL DEFAULT 'default',
  avatar_color TEXT NOT NULL DEFAULT '#6366f1',
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  last_seen_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  apns_token TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_apple_sub ON users(apple_sub);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- ============================================
-- USER STATS
-- ============================================
CREATE TABLE IF NOT EXISTS user_stats (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  games_played INTEGER NOT NULL DEFAULT 0,
  games_won INTEGER NOT NULL DEFAULT 0,
  games_lost INTEGER NOT NULL DEFAULT 0,
  sequences_completed INTEGER NOT NULL DEFAULT 0,
  current_win_streak INTEGER NOT NULL DEFAULT 0,
  longest_win_streak INTEGER NOT NULL DEFAULT 0,
  games_by_team_color TEXT NOT NULL DEFAULT '{}', -- JSON: { "blue": 5, "green": 3 }
  cards_played INTEGER NOT NULL DEFAULT 0,
  two_eyed_jacks_used INTEGER NOT NULL DEFAULT 0,
  one_eyed_jacks_used INTEGER NOT NULL DEFAULT 0,
  dead_cards_replaced INTEGER NOT NULL DEFAULT 0,
  total_turns_taken INTEGER NOT NULL DEFAULT 0,
  first_move_games INTEGER NOT NULL DEFAULT 0,
  first_move_wins INTEGER NOT NULL DEFAULT 0,
  series_played INTEGER NOT NULL DEFAULT 0,
  series_won INTEGER NOT NULL DEFAULT 0,
  series_lost INTEGER NOT NULL DEFAULT 0,
  total_play_time_ms INTEGER NOT NULL DEFAULT 0,
  fastest_win_ms INTEGER,
  impossible_bot_wins INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

-- ============================================
-- GAME HISTORY
-- ============================================
CREATE TABLE IF NOT EXISTS game_history (
  id TEXT PRIMARY KEY,
  room_code TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  player_count INTEGER NOT NULL,
  team_count INTEGER NOT NULL,
  winning_team_idx INTEGER,
  was_stalemate INTEGER NOT NULL DEFAULT 0,
  game_variant TEXT NOT NULL DEFAULT 'classic',
  sequence_length INTEGER NOT NULL DEFAULT 5,
  sequences_to_win INTEGER NOT NULL DEFAULT 2,
  is_series_game INTEGER NOT NULL DEFAULT 0,
  series_id TEXT,
  bot_difficulty TEXT
);

CREATE INDEX IF NOT EXISTS idx_game_history_ended_at ON game_history(ended_at);

-- ============================================
-- GAME PARTICIPANTS
-- ============================================
CREATE TABLE IF NOT EXISTS game_participants (
  game_id TEXT NOT NULL REFERENCES game_history(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_index INTEGER NOT NULL,
  team_color TEXT NOT NULL,
  seat_index INTEGER NOT NULL,
  won INTEGER NOT NULL DEFAULT 0,
  turns_taken INTEGER NOT NULL DEFAULT 0,
  cards_played INTEGER NOT NULL DEFAULT 0,
  two_eyed_used INTEGER NOT NULL DEFAULT 0,
  one_eyed_used INTEGER NOT NULL DEFAULT 0,
  dead_replaced INTEGER NOT NULL DEFAULT 0,
  sequences_made INTEGER NOT NULL DEFAULT 0,
  went_first INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (game_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_game_participants_user_id ON game_participants(user_id);

-- ============================================
-- FRIENDS
-- ============================================
CREATE TABLE IF NOT EXISTS friends (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'blocked')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  accepted_at INTEGER,
  PRIMARY KEY (user_id, friend_id)
);

CREATE INDEX IF NOT EXISTS idx_friends_friend_id ON friends(friend_id);
CREATE INDEX IF NOT EXISTS idx_friends_status ON friends(status);

-- ============================================
-- GAME INVITES
-- ============================================
CREATE TABLE IF NOT EXISTS game_invites (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'expired')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_game_invites_recipient ON game_invites(recipient_id, status);
