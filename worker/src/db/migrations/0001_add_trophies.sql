-- Migration 0001: Add trophy tracking columns
-- Run with: wrangler d1 execute sequence-db --file=worker/src/db/migrations/0001_add_trophies.sql

-- Track impossible bot wins for trophy/achievement system
ALTER TABLE user_stats ADD COLUMN impossible_bot_wins INTEGER NOT NULL DEFAULT 0;

-- Track bot difficulty in game history
ALTER TABLE game_history ADD COLUMN bot_difficulty TEXT;
