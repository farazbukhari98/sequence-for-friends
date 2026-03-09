-- Migration 0002: Track game variant in game history
-- Run with: wrangler d1 execute sequence-db --file=worker/src/db/migrations/0002_add_game_variant.sql

ALTER TABLE game_history ADD COLUMN game_variant TEXT NOT NULL DEFAULT 'classic';
