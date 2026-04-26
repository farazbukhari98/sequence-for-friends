-- Migration 0002: Track game variant in game history
-- Apply with: wrangler d1 migrations apply sequence-db

ALTER TABLE game_history ADD COLUMN game_variant TEXT NOT NULL DEFAULT 'classic';
