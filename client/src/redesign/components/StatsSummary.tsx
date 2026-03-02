import type { UserStats } from '../../../../shared/types';
import './StatsSummary.css';

interface StatsSummaryProps {
  stats: UserStats;
}

function formatTime(ms: number): string {
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  return `${Math.round(ms / 3600000)}h`;
}

export function StatsSummary({ stats }: StatsSummaryProps) {
  return (
    <div className="stats-summary">
      <div className="stats-row stats-main">
        <div className="stat-card stat-highlight">
          <span className="stat-value">{stats.winRate}%</span>
          <span className="stat-label">Win Rate</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.gamesPlayed}</span>
          <span className="stat-label">Games</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.gamesWon}</span>
          <span className="stat-label">Wins</span>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-value">{stats.currentWinStreak}</span>
          <span className="stat-label">Current Streak</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.longestWinStreak}</span>
          <span className="stat-label">Best Streak</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.sequencesCompleted}</span>
          <span className="stat-label">Sequences</span>
        </div>
      </div>

      <div className="stats-section">
        <h3 className="stats-section-title">Card Play</h3>
        <div className="stats-row stats-row-4">
          <div className="stat-card stat-sm">
            <span className="stat-value">{stats.cardsPlayed}</span>
            <span className="stat-label">Cards Played</span>
          </div>
          <div className="stat-card stat-sm">
            <span className="stat-value">{stats.twoEyedJacksUsed}</span>
            <span className="stat-label">Two-eyed Jacks</span>
          </div>
          <div className="stat-card stat-sm">
            <span className="stat-value">{stats.oneEyedJacksUsed}</span>
            <span className="stat-label">One-eyed Jacks</span>
          </div>
          <div className="stat-card stat-sm">
            <span className="stat-value">{stats.deadCardsReplaced}</span>
            <span className="stat-label">Dead Cards</span>
          </div>
        </div>
      </div>

      {stats.seriesPlayed > 0 && (
        <div className="stats-section">
          <h3 className="stats-section-title">Series</h3>
          <div className="stats-row">
            <div className="stat-card stat-sm">
              <span className="stat-value">{stats.seriesPlayed}</span>
              <span className="stat-label">Played</span>
            </div>
            <div className="stat-card stat-sm">
              <span className="stat-value">{stats.seriesWon}</span>
              <span className="stat-label">Won</span>
            </div>
          </div>
        </div>
      )}

      {stats.hasBeatImpossibleBot && (
        <div className="stats-section">
          <h3 className="stats-section-title">Achievements</h3>
          <div className="achievement-card">
            <span className="achievement-icon">&#x1F3C6;</span>
            <div className="achievement-info">
              <span className="achievement-name">Impossible Victor</span>
              <span className="achievement-desc">
                Defeated the Impossible bot{stats.impossibleBotWins > 1 ? ` ${stats.impossibleBotWins} times` : ''}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="stats-section">
        <h3 className="stats-section-title">Time</h3>
        <div className="stats-row">
          <div className="stat-card stat-sm">
            <span className="stat-value">{formatTime(stats.totalPlayTimeMs)}</span>
            <span className="stat-label">Total Play Time</span>
          </div>
          {stats.fastestWinMs && (
            <div className="stat-card stat-sm">
              <span className="stat-value">{formatTime(stats.fastestWinMs)}</span>
              <span className="stat-label">Fastest Win</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
