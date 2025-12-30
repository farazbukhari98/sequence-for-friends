import { useState } from 'react';
import type { RoomInfo, PublicPlayer, TurnTimeLimit, SequencesToWin, SequenceLength, SeriesLength, TeamSwitchRequest } from '../../../shared/types';
import { getTeamColorHex, getTeamLetter, VALID_PLAYER_COUNTS, TURN_TIME_OPTIONS, SEQUENCES_TO_WIN_OPTIONS, SEQUENCE_LENGTH_OPTIONS, SERIES_LENGTH_OPTIONS } from '../../../shared/types';
import { GameModeModal, getActiveModes } from './GameModeModal';
import type { GameModeType } from './GameModeModal';
import type { GameModeInfo } from '../hooks/useSocket';
import './LobbyScreen.css';

interface LobbyScreenProps {
  roomInfo: RoomInfo;
  playerId: string;
  teamSwitchRequest: TeamSwitchRequest | null;
  teamSwitchResponse: { playerId: string; approved: boolean; playerName: string } | null;
  gameModeInfo: GameModeInfo | null;
  onLeave: () => void;
  onKickPlayer: (playerId: string) => void;
  onStartGame: () => Promise<{ success: boolean; error?: string }>;
  onUpdateSettings: (settings: { turnTimeLimit?: TurnTimeLimit; sequencesToWin?: SequencesToWin; sequenceLength?: SequenceLength; seriesLength?: SeriesLength }) => Promise<{ success: boolean; error?: string }>;
  onToggleReady: () => Promise<{ success: boolean; error?: string }>;
  onRequestTeamSwitch: (toTeamIndex: number) => Promise<{ success: boolean; error?: string }>;
  onRespondTeamSwitch: (playerId: string, approved: boolean) => Promise<{ success: boolean; error?: string }>;
  onClearTeamSwitchRequest: () => void;
  onClearGameModeInfo: () => void;
}

export function LobbyScreen({
  roomInfo,
  playerId,
  teamSwitchRequest,
  teamSwitchResponse,
  gameModeInfo,
  onLeave,
  onKickPlayer,
  onStartGame,
  onUpdateSettings,
  onToggleReady,
  onRequestTeamSwitch,
  onRespondTeamSwitch,
  onClearTeamSwitchRequest,
  onClearGameModeInfo,
}: LobbyScreenProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const isHost = roomInfo.hostId === playerId;
  const canStart = VALID_PLAYER_COUNTS.includes(roomInfo.players.length);
  const allPlayersReady = roomInfo.players.every(p => p.ready);
  const myPlayer = roomInfo.players.find(p => p.id === playerId);

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    const result = await onStartGame();
    setLoading(false);
    if (result.error) {
      setError(result.error);
    }
  };

  const handleToggleReady = async () => {
    const result = await onToggleReady();
    if (result.error) {
      setError(result.error);
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomInfo.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = roomInfo.code;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: 'Join my Sequence game!',
      text: `Join my Sequence game "${roomInfo.name}"! Room code: ${roomInfo.code}`,
      url: window.location.origin + window.location.pathname + "?room=" + roomInfo.code,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // User cancelled or error
      }
    } else {
      handleCopyCode();
    }
  };

  const handleTeamSwitchRequest = async (toTeamIndex: number) => {
    const result = await onRequestTeamSwitch(toTeamIndex);
    if (result.error) {
      setError(result.error);
    }
  };

  const handleRespondTeamSwitch = async (approved: boolean) => {
    if (!teamSwitchRequest) return;
    await onRespondTeamSwitch(teamSwitchRequest.playerId, approved);
    onClearTeamSwitchRequest();
  };

  const handleUpdateTurnTimeLimit = async (value: TurnTimeLimit) => {
    const result = await onUpdateSettings({ turnTimeLimit: value });
    if (result.error) {
      setError(result.error);
    }
  };

  const handleUpdateSequencesToWin = async (value: SequencesToWin) => {
    const result = await onUpdateSettings({ sequencesToWin: value });
    if (result.error) {
      setError(result.error);
    }
  };

  const handleUpdateSequenceLength = async (value: SequenceLength) => {
    const result = await onUpdateSettings({ sequenceLength: value });
    if (result.error) {
      setError(result.error);
    }
  };

  const handleSpeedSequencePreset = async () => {
    // Speed Sequence: 15s timer + Blitz (4-in-a-row)
    const result = await onUpdateSettings({
      turnTimeLimit: 15,
      sequenceLength: 4
    });
    if (result.error) {
      setError(result.error);
    }
  };

  const handleClassicPreset = async () => {
    // Classic: No timer + Standard (5-in-a-row)
    const result = await onUpdateSettings({
      turnTimeLimit: 0,
      sequenceLength: 5
    });
    if (result.error) {
      setError(result.error);
    }
  };

  const handleUpdateSeriesLength = async (value: SeriesLength) => {
    const result = await onUpdateSettings({ seriesLength: value });
    if (result.error) {
      setError(result.error);
    }
  };

  // Get teams for display
  const teams: Map<number, PublicPlayer[]> = new Map();
  for (let i = 0; i < roomInfo.teamCount; i++) {
    teams.set(i, []);
  }
  for (const player of roomInfo.players) {
    const teamPlayers = teams.get(player.teamIndex) || [];
    teamPlayers.push(player);
    teams.set(player.teamIndex, teamPlayers);
  }

  const teamColors = roomInfo.teamCount === 2 ? ['blue', 'green'] : ['blue', 'green', 'red'];
  const teamNames = ['Blue Team', 'Green Team', 'Red Team'];

  return (
    <div className="lobby-screen">
      <header className="lobby-header">
        <button className="back-button" onClick={onLeave}>
          ← Leave
        </button>
        <h1>{roomInfo.name}</h1>
        <div className="header-spacer"></div>
      </header>

      <div className="lobby-content">
        {/* Room Code */}
        <div className="room-code-card">
          <div className="room-code-label">Room Code</div>
          <div className="room-code-value" onClick={handleCopyCode}>
            {roomInfo.code}
          </div>
          <div className="room-code-actions">
            <button className="btn btn-secondary btn-sm" onClick={handleCopyCode}>
              {copied ? '✓ Copied!' : 'Copy Code'}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handleShare}>
              Share
            </button>
          </div>
        </div>

        {/* Team Switch Request Modal (for host) */}
        {isHost && teamSwitchRequest && (
          <div className="team-switch-modal">
            <div className="team-switch-content">
              <p>
                <strong>{teamSwitchRequest.playerName}</strong> wants to switch from{' '}
                <span style={{ color: getTeamColorHex(teamColors[teamSwitchRequest.fromTeamIndex] as 'blue' | 'green' | 'red') }}>
                  {teamNames[teamSwitchRequest.fromTeamIndex]}
                </span>{' '}
                to{' '}
                <span style={{ color: getTeamColorHex(teamColors[teamSwitchRequest.toTeamIndex] as 'blue' | 'green' | 'red') }}>
                  {teamNames[teamSwitchRequest.toTeamIndex]}
                </span>
              </p>
              <div className="team-switch-actions">
                <button className="btn btn-primary btn-sm" onClick={() => handleRespondTeamSwitch(true)}>
                  Approve
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => handleRespondTeamSwitch(false)}>
                  Deny
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Team Switch Response (for requester) */}
        {teamSwitchResponse && teamSwitchResponse.playerId === playerId && (
          <div className={`team-switch-response ${teamSwitchResponse.approved ? 'approved' : 'denied'}`}>
            {teamSwitchResponse.approved
              ? 'Your team switch request was approved!'
              : 'Your team switch request was denied.'}
          </div>
        )}

        {/* Teams Section */}
        <div className="teams-section">
          <div className="teams-header">
            <h2>Teams</h2>
            <span className="player-count">
              {roomInfo.players.length} / {roomInfo.maxPlayers} players
            </span>
          </div>

          <div className="teams-grid">
            {Array.from(teams.entries()).map(([teamIndex, teamPlayers]) => (
              <div key={teamIndex} className="team-card">
                <div
                  className="team-header"
                  style={{
                    backgroundColor: getTeamColorHex(teamColors[teamIndex] as 'blue' | 'green' | 'red'),
                  }}
                >
                  <span className="team-name">{teamNames[teamIndex]}</span>
                  <span className="team-letter">{getTeamLetter(teamColors[teamIndex] as 'blue' | 'green' | 'red')}</span>
                </div>
                <div className="team-players">
                  {teamPlayers.map((player) => (
                    <div
                      key={player.id}
                      className={`team-player ${!player.connected ? 'disconnected' : ''} ${player.ready ? 'ready' : ''}`}
                    >
                      <span className="player-name">
                        {player.name}
                        {player.id === roomInfo.hostId && <span className="host-badge">Host</span>}
                        {player.id === playerId && <span className="me-badge">You</span>}
                      </span>
                      <span className={`ready-status ${player.ready ? 'is-ready' : ''}`}>
                        {player.ready ? '✓ Ready' : 'Not Ready'}
                      </span>
                      {!player.connected && <span className="disconnected-badge">Offline</span>}
                      {isHost && player.id !== playerId && (
                        <button className="kick-button" onClick={() => onKickPlayer(player.id)} title="Kick player">
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  {teamPlayers.length === 0 && (
                    <div className="team-player empty">No players yet</div>
                  )}
                </div>
                {/* Switch to this team button */}
                {myPlayer && myPlayer.teamIndex !== teamIndex && (
                  <button
                    className="switch-team-btn"
                    onClick={() => handleTeamSwitchRequest(teamIndex)}
                  >
                    {isHost ? 'Switch Here' : 'Request to Join'}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Empty slots */}
          {roomInfo.players.length < roomInfo.maxPlayers && (
            <div className="empty-slots">
              Waiting for {roomInfo.maxPlayers - roomInfo.players.length} more player{roomInfo.maxPlayers - roomInfo.players.length > 1 ? 's' : ''}...
            </div>
          )}
        </div>

        {/* Game Info */}
        <div className="game-info">
          <div className="info-item">
            <span className="info-label">Teams</span>
            <span className="info-value">{roomInfo.teamCount}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Mode</span>
            <span className="info-value">
              {roomInfo.sequenceLength === 4 ? 'Blitz' : 'Standard'}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Series</span>
            <span className="info-value">
              {roomInfo.seriesLength === 0 ? 'Single' : `Bo${roomInfo.seriesLength}`}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Timer</span>
            <span className="info-value">
              {roomInfo.turnTimeLimit === 0 ? 'None' : `${roomInfo.turnTimeLimit}s`}
            </span>
          </div>
        </div>

        {/* Game Settings (Host Only) */}
        {isHost && (
          <div className="settings-section">
            <h3>Game Settings</h3>

            {/* Quick Presets */}
            <div className="setting-group presets-group">
              <label className="setting-label">Quick Presets</label>
              <div className="presets-options">
                <button
                  className={`preset-btn ${roomInfo.turnTimeLimit === 0 && roomInfo.sequenceLength === 5 ? 'active' : ''}`}
                  onClick={handleClassicPreset}
                >
                  Classic
                </button>
                <button
                  className={`preset-btn speed ${roomInfo.turnTimeLimit === 15 && roomInfo.sequenceLength === 4 ? 'active' : ''}`}
                  onClick={handleSpeedSequencePreset}
                >
                  Speed Sequence
                </button>
              </div>
            </div>

            <div className="setting-group">
              <label className="setting-label">Game Mode</label>
              <div className="game-mode-options">
                {SEQUENCE_LENGTH_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    className={`game-mode-btn ${roomInfo.sequenceLength === option.value ? 'active' : ''}`}
                    onClick={() => handleUpdateSequenceLength(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="setting-hint">
                {roomInfo.sequenceLength === 4
                  ? 'Blitz: Faster games with 4-in-a-row sequences'
                  : 'Standard: Classic 5-in-a-row sequences'}
              </p>
            </div>

            <div className="setting-group">
              <label className="setting-label">Sequences to Win</label>
              <div className="sequences-options">
                {SEQUENCES_TO_WIN_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    className={`sequences-option-btn ${roomInfo.sequencesToWin === option.value ? 'active' : ''}`}
                    onClick={() => handleUpdateSequencesToWin(option.value)}
                  >
                    {option.value}
                  </button>
                ))}
              </div>
              <p className="setting-hint">
                First team to complete {roomInfo.sequencesToWin} sequence{roomInfo.sequencesToWin > 1 ? 's' : ''} wins
              </p>
            </div>

            <div className="setting-group">
              <label className="setting-label">Turn Timer</label>
              <div className="time-limit-options">
                {TURN_TIME_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    className={`time-option-btn ${roomInfo.turnTimeLimit === option.value ? 'active' : ''}`}
                    onClick={() => handleUpdateTurnTimeLimit(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="setting-group">
              <label className="setting-label">Series Mode</label>
              <div className="series-options">
                {SERIES_LENGTH_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    className={`series-option-btn ${roomInfo.seriesLength === option.value ? 'active' : ''}`}
                    onClick={() => handleUpdateSeriesLength(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="setting-hint">
                {roomInfo.seriesLength === 0
                  ? 'Single game - winner takes all'
                  : `Best of ${roomInfo.seriesLength} - first to ${Math.ceil(roomInfo.seriesLength / 2)} wins`}
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && <div className="form-error">{error}</div>}

        {/* Ready Button */}
        <button
          className={`btn btn-lg w-full ${myPlayer?.ready ? 'btn-secondary' : 'btn-primary'}`}
          onClick={handleToggleReady}
        >
          {myPlayer?.ready ? 'Cancel Ready' : 'Ready Up!'}
        </button>

        {/* Start Button (Host only) */}
        {isHost ? (
          <button
            className="btn btn-primary btn-lg w-full start-button"
            onClick={handleStart}
            disabled={loading || !canStart || !allPlayersReady}
          >
            {loading
              ? 'Starting...'
              : !canStart
                ? `Need ${findNearestValidCount(roomInfo.players.length)} players`
                : !allPlayersReady
                  ? 'Waiting for all players to be ready'
                  : 'Start Game'}
          </button>
        ) : (
          <div className="waiting-message">
            {allPlayersReady
              ? 'Waiting for host to start the game...'
              : 'Waiting for all players to be ready...'}
          </div>
        )}
      </div>

      {/* Game Mode Info Modal */}
      {gameModeInfo && (
        <GameModeModal
          modes={gameModeInfo.modes as GameModeType[]}
          hostName={gameModeInfo.changedBy}
          onAcknowledge={onClearGameModeInfo}
        />
      )}
    </div>
  );
}

function findNearestValidCount(current: number): number {
  for (const count of VALID_PLAYER_COUNTS) {
    if (count >= current) return count;
  }
  return VALID_PLAYER_COUNTS[VALID_PLAYER_COUNTS.length - 1];
}
