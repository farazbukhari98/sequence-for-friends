import { useState } from 'react';
import type { RoomInfo, PublicPlayer, TurnTimeLimit, TeamSwitchRequest } from '../../../shared/types';
import { getTeamColorHex, getTeamLetter, VALID_PLAYER_COUNTS, TURN_TIME_OPTIONS } from '../../../shared/types';
import './LobbyScreen.css';

interface LobbyScreenProps {
  roomInfo: RoomInfo;
  playerId: string;
  teamSwitchRequest: TeamSwitchRequest | null;
  teamSwitchResponse: { playerId: string; approved: boolean; playerName: string } | null;
  onLeave: () => void;
  onKickPlayer: (playerId: string) => void;
  onStartGame: () => Promise<{ success: boolean; error?: string }>;
  onUpdateSettings: (turnTimeLimit: TurnTimeLimit) => Promise<{ success: boolean; error?: string }>;
  onToggleReady: () => Promise<{ success: boolean; error?: string }>;
  onRequestTeamSwitch: (toTeamIndex: number) => Promise<{ success: boolean; error?: string }>;
  onRespondTeamSwitch: (playerId: string, approved: boolean) => Promise<{ success: boolean; error?: string }>;
  onClearTeamSwitchRequest: () => void;
}

export function LobbyScreen({
  roomInfo,
  playerId,
  teamSwitchRequest,
  teamSwitchResponse,
  onLeave,
  onKickPlayer,
  onStartGame,
  onUpdateSettings,
  onToggleReady,
  onRequestTeamSwitch,
  onRespondTeamSwitch,
  onClearTeamSwitchRequest,
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
      url: window.location.href,
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
            <span className="info-label">To Win</span>
            <span className="info-value">
              {roomInfo.teamCount === 2 ? '2 sequences' : '1 sequence'}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Turn Timer</span>
            <span className="info-value">
              {roomInfo.turnTimeLimit === 0 ? 'No Limit' : `${roomInfo.turnTimeLimit}s`}
            </span>
          </div>
        </div>

        {/* Turn Time Limit Setting (Host Only) */}
        {isHost && (
          <div className="settings-section">
            <h3>Turn Timer</h3>
            <div className="time-limit-options">
              {TURN_TIME_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  className={`time-option-btn ${roomInfo.turnTimeLimit === option.value ? 'active' : ''}`}
                  onClick={() => onUpdateSettings(option.value)}
                >
                  {option.label}
                </button>
              ))}
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
    </div>
  );
}

function findNearestValidCount(current: number): number {
  for (const count of VALID_PLAYER_COUNTS) {
    if (count >= current) return count;
  }
  return VALID_PLAYER_COUNTS[VALID_PLAYER_COUNTS.length - 1];
}
