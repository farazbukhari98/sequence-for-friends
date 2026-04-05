import { describe, expect, it } from 'vitest';

import { buildInsightsPayload } from '../worker/src/api';

describe('buildInsightsPayload', () => {
  it('falls back to aggregate stats when raw history insights are unavailable', () => {
    const insights = buildInsightsPayload(
      {
        favoriteColor: null,
        avgDuration: null,
        avgTurns: null,
        avgSequences: null,
      },
      {
        gamesPlayed: 4,
        gamesByTeamColor: { green: 3, blue: 1 },
        cardsPlayed: 20,
        twoEyedJacksUsed: 2,
        oneEyedJacksUsed: 1,
        firstMoveGames: 2,
        firstMoveWins: 1,
        totalTurnsTaken: 28,
        sequencesCompleted: 6,
        totalPlayTimeMs: 640_000,
      }
    );

    expect(insights).toEqual({
      avgGameDurationMs: 160000,
      favoriteTeamColor: 'green',
      jackUsageRate: 0.15,
      firstMoveWinRate: 50,
      avgTurnsPerGame: 7,
      avgSequencesPerGame: 1.5,
      totalPlayTimeFormatted: '11m',
    });
  });

  it('prefers detailed history values when they exist', () => {
    const insights = buildInsightsPayload(
      {
        favoriteColor: 'blue',
        avgDuration: 90_499.6,
        avgTurns: 6.64,
        avgSequences: 1.26,
      },
      {
        gamesPlayed: 4,
        gamesByTeamColor: { green: 3, blue: 1 },
        cardsPlayed: 20,
        twoEyedJacksUsed: 2,
        oneEyedJacksUsed: 1,
        firstMoveGames: 2,
        firstMoveWins: 1,
        totalTurnsTaken: 28,
        sequencesCompleted: 6,
        totalPlayTimeMs: 640_000,
      }
    );

    expect(insights.avgGameDurationMs).toBe(160000);
    expect(insights.favoriteTeamColor).toBe('green');
    expect(insights.avgTurnsPerGame).toBe(7);
    expect(insights.avgSequencesPerGame).toBe(1.5);
  });

  it('uses detailed history values when aggregate stats are unavailable', () => {
    const insights = buildInsightsPayload(
      {
        favoriteColor: 'blue',
        avgDuration: 90_499.6,
        avgTurns: 6.64,
        avgSequences: 1.26,
      },
      {
        gamesPlayed: 0,
        gamesByTeamColor: {},
        cardsPlayed: 20,
        twoEyedJacksUsed: 2,
        oneEyedJacksUsed: 1,
        firstMoveGames: 2,
        firstMoveWins: 1,
        totalTurnsTaken: 0,
        sequencesCompleted: 0,
        totalPlayTimeMs: 0,
      }
    );

    expect(insights.avgGameDurationMs).toBe(90500);
    expect(insights.favoriteTeamColor).toBe('blue');
    expect(insights.avgTurnsPerGame).toBe(6.6);
    expect(insights.avgSequencesPerGame).toBe(1.3);
  });
});
