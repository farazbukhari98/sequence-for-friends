import { describe, expect, it } from 'vitest';

import {
  getUserStats,
  incrementSeriesStats,
  insertGameHistory,
  type DbGameHistory,
  type DbGameParticipant,
  type DbUserStats,
} from '../worker/src/db/queries';

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

class FakePreparedStatement {
  constructor(
    private readonly db: FakeD1Database,
    private readonly sql: string,
    private readonly params: unknown[] = []
  ) {}

  bind(...params: unknown[]) {
    return new FakePreparedStatement(this.db, this.sql, params);
  }

  first<T>() {
    return this.db.first<T>(this.sql, this.params);
  }

  all<T>() {
    return this.db.all<T>(this.sql, this.params);
  }

  run() {
    return this.db.run(this.sql, this.params);
  }
}

class FakeD1Database {
  readonly userStats = new Map<string, DbUserStats>();
  readonly historyRows = new Map<string, HistoricalStatsRow[]>();

  prepare(sql: string) {
    return new FakePreparedStatement(this, sql);
  }

  async batch(statements: FakePreparedStatement[]) {
    for (const statement of statements) {
      await statement.run();
    }
    return [];
  }

  async first<T>(sql: string, params: unknown[]): Promise<T | null> {
    if (sql.includes('SELECT * FROM user_stats WHERE user_id = ?')) {
      return (this.userStats.get(String(params[0])) as T | undefined) ?? null;
    }
    throw new Error(`Unsupported first() SQL in test: ${sql}`);
  }

  async all<T>(sql: string, params: unknown[]): Promise<{ results: T[] }> {
    if (sql.includes('FROM game_participants gp') && sql.includes('JOIN game_history gh')) {
      return {
        results: ((this.historyRows.get(String(params[0])) ?? []) as T[]),
      };
    }
    throw new Error(`Unsupported all() SQL in test: ${sql}`);
  }

  async run(sql: string, params: unknown[]) {
    if (sql.includes('INSERT OR IGNORE INTO user_stats')) {
      const userId = String(params[0]);
      if (!this.userStats.has(userId)) {
        this.userStats.set(userId, {
          user_id: userId,
          games_played: Number(params[1]),
          games_won: Number(params[2]),
          games_lost: Number(params[3]),
          sequences_completed: Number(params[4]),
          current_win_streak: Number(params[5]),
          longest_win_streak: Number(params[6]),
          games_by_team_color: String(params[7]),
          cards_played: Number(params[8]),
          two_eyed_jacks_used: Number(params[9]),
          one_eyed_jacks_used: Number(params[10]),
          dead_cards_replaced: Number(params[11]),
          total_turns_taken: Number(params[12]),
          first_move_games: Number(params[13]),
          first_move_wins: Number(params[14]),
          series_played: Number(params[15]),
          series_won: Number(params[16]),
          series_lost: Number(params[17]),
          total_play_time_ms: Number(params[18]),
          fastest_win_ms: params[19] == null ? null : Number(params[19]),
          impossible_bot_wins: Number(params[20]),
          updated_at: Number(params[21]),
        });
      }
      return { success: true };
    }

    if (sql.includes('series_played = series_played + 1')) {
      const userId = String(params[3]);
      const current = this.userStats.get(userId);
      if (!current) {
        throw new Error(`Missing stats row for ${userId}`);
      }

      this.userStats.set(userId, {
        ...current,
        series_played: current.series_played + 1,
        series_won: current.series_won + Number(params[0]),
        series_lost: current.series_lost + Number(params[1]),
        updated_at: Number(params[2]),
      });
      return { success: true };
    }

    if (sql.includes('UPDATE user_stats SET')) {
      const userId = String(params[19]);
      const current = this.userStats.get(userId);
      if (!current) {
        throw new Error(`Missing stats row for ${userId}`);
      }

      const won = Number(params[0]);
      const durationMs = Number(params[12]);
      const updated: DbUserStats = {
        ...current,
        games_played: current.games_played + 1,
        games_won: current.games_won + won,
        games_lost: current.games_lost + Number(params[1]),
        sequences_completed: current.sequences_completed + Number(params[2]),
        current_win_streak: won === 1 ? current.current_win_streak + 1 : 0,
        longest_win_streak: won === 1
          ? Math.max(current.longest_win_streak, current.current_win_streak + 1)
          : current.longest_win_streak,
        cards_played: current.cards_played + Number(params[5]),
        two_eyed_jacks_used: current.two_eyed_jacks_used + Number(params[6]),
        one_eyed_jacks_used: current.one_eyed_jacks_used + Number(params[7]),
        dead_cards_replaced: current.dead_cards_replaced + Number(params[8]),
        total_turns_taken: current.total_turns_taken + Number(params[9]),
        first_move_games: current.first_move_games + Number(params[10]),
        first_move_wins: current.first_move_wins + Number(params[11]),
        total_play_time_ms: current.total_play_time_ms + durationMs,
        fastest_win_ms: won === 1
          ? current.fastest_win_ms == null ? durationMs : Math.min(current.fastest_win_ms, durationMs)
          : current.fastest_win_ms,
        impossible_bot_wins: current.impossible_bot_wins + (
          params[16] === 'impossible' && Number(params[17]) === 1 ? 1 : 0
        ),
        updated_at: Number(params[18]),
      };

      this.userStats.set(userId, updated);
      return { success: true };
    }

    if (sql.includes('INSERT INTO game_history') || sql.includes('INSERT INTO game_participants')) {
      return { success: true };
    }

    throw new Error(`Unsupported run() SQL in test: ${sql}`);
  }
}

function createHistoryGame(overrides: Partial<HistoricalStatsRow> = {}): HistoricalStatsRow {
  return {
    won: 0,
    sequences_made: 0,
    cards_played: 0,
    two_eyed_used: 0,
    one_eyed_used: 0,
    dead_replaced: 0,
    turns_taken: 0,
    went_first: 0,
    team_color: 'blue',
    duration_ms: 1200,
    ended_at: 1,
    bot_difficulty: null,
    ...overrides,
  };
}

describe('stats persistence', () => {
  it('rebuilds missing aggregate stats rows from stored game history', async () => {
    const db = new FakeD1Database();
    db.historyRows.set('legacy-user', [
      createHistoryGame({
        won: 0,
        sequences_made: 1,
        cards_played: 8,
        turns_taken: 4,
        went_first: 1,
        team_color: 'blue',
        duration_ms: 2400,
        ended_at: 100,
      }),
      createHistoryGame({
        won: 1,
        sequences_made: 2,
        cards_played: 9,
        two_eyed_used: 1,
        turns_taken: 5,
        team_color: 'green',
        duration_ms: 900,
        ended_at: 200,
      }),
      createHistoryGame({
        won: 1,
        sequences_made: 1,
        cards_played: 7,
        one_eyed_used: 1,
        turns_taken: 4,
        went_first: 1,
        team_color: 'green',
        duration_ms: 800,
        ended_at: 300,
        bot_difficulty: 'impossible',
      }),
    ]);

    const stats = await getUserStats(db as unknown as D1Database, 'legacy-user');

    expect(stats).not.toBeNull();
    expect(stats?.games_played).toBe(3);
    expect(stats?.games_won).toBe(2);
    expect(stats?.games_lost).toBe(1);
    expect(stats?.sequences_completed).toBe(4);
    expect(stats?.current_win_streak).toBe(2);
    expect(stats?.longest_win_streak).toBe(2);
    expect(stats?.cards_played).toBe(24);
    expect(stats?.total_turns_taken).toBe(13);
    expect(stats?.first_move_games).toBe(2);
    expect(stats?.first_move_wins).toBe(1);
    expect(stats?.total_play_time_ms).toBe(4100);
    expect(stats?.fastest_win_ms).toBe(800);
    expect(stats?.impossible_bot_wins).toBe(1);
    expect(JSON.parse(stats?.games_by_team_color ?? '{}')).toEqual({ blue: 1, green: 2 });
  });

  it('creates a missing stats row before applying fresh game results', async () => {
    const db = new FakeD1Database();
    db.historyRows.set('player-1', [
      createHistoryGame({
        won: 1,
        sequences_made: 2,
        cards_played: 10,
        turns_taken: 5,
        team_color: 'blue',
        duration_ms: 1500,
        ended_at: 100,
      }),
    ]);

    const game: DbGameHistory = {
      id: 'game-2',
      room_code: 'ABCDE',
      started_at: 200,
      ended_at: 400,
      duration_ms: 2000,
      player_count: 2,
      team_count: 2,
      winning_team_idx: 1,
      was_stalemate: 0,
      game_variant: 'classic',
      sequence_length: 5,
      sequences_to_win: 2,
      is_series_game: 0,
      series_id: null,
      bot_difficulty: null,
    };

    const participants: DbGameParticipant[] = [
      {
        game_id: 'game-2',
        user_id: 'player-1',
        team_index: 0,
        team_color: 'blue',
        seat_index: 0,
        won: 0,
        turns_taken: 6,
        cards_played: 11,
        two_eyed_used: 1,
        one_eyed_used: 0,
        dead_replaced: 0,
        sequences_made: 1,
        went_first: 1,
      },
    ];

    await insertGameHistory(db as unknown as D1Database, game, participants);

    const stats = db.userStats.get('player-1');
    expect(stats).toBeDefined();
    expect(stats?.games_played).toBe(2);
    expect(stats?.games_won).toBe(1);
    expect(stats?.games_lost).toBe(1);
    expect(stats?.sequences_completed).toBe(3);
    expect(stats?.current_win_streak).toBe(0);
    expect(stats?.longest_win_streak).toBe(1);
    expect(stats?.cards_played).toBe(21);
    expect(stats?.two_eyed_jacks_used).toBe(1);
    expect(stats?.total_turns_taken).toBe(11);
    expect(stats?.first_move_games).toBe(1);
    expect(stats?.first_move_wins).toBe(0);
    expect(stats?.total_play_time_ms).toBe(3500);
    expect(stats?.fastest_win_ms).toBe(1500);
  });

  it('increments series aggregate stats once per participant', async () => {
    const db = new FakeD1Database();

    await incrementSeriesStats(db as unknown as D1Database, [
      { user_id: 'winner', won: 1 },
      { user_id: 'loser', won: 0 },
    ]);

    expect(db.userStats.get('winner')).toMatchObject({
      series_played: 1,
      series_won: 1,
      series_lost: 0,
    });
    expect(db.userStats.get('loser')).toMatchObject({
      series_played: 1,
      series_won: 0,
      series_lost: 1,
    });
  });
});
