import { useState } from 'react';
import type { RoomInfo, PublicPlayer, TurnTimeLimit } from '../../../shared/types';
import { getTeamColorHex, getTeamLetter, VALID_PLAYER_COUNTS, TURN_TIME_OPTIONS } from '../../../shared/types';
import './LobbyScreen.css';

interface LobbyScreenProps {
  roomInfo: RoomInfo;
  playerId: string;
  onLeave: () => void;
  onKickPlayer: (playerId: string) => void;
  onStartGame: () => Promise<{ success: boolean; error?: string }>;
  onUpdateSettings: (turnTimeLimit: TurnTimeLimit) => Promise<{ success: boolean; error?: string }>;
}

export function LobbyScreen({
  roomInfo,
  playerId,
  onLeave,
  onKickPlayer,
  onStartGame,
  onUpdateSettings,
}: LobbyScreenProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const isHost = roomInfo.hostId === playerId;
  const canStart = VALID_PLAYER_COUNTS.includes(roomInfo.players.length);

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    const result = await onStartGame();
    setLoading(false);
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
      text: `Join my Sequence game! Room code: ${roomInfo.code}`,
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

  return (
    <div className="lobby-screen">
      <header className="lobby-header">
        <button className="back-button" onClick={onLeave}>
          ← Leave
        </button>
        <h1>Lobby</h1>
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

        {/* Player List */}
        <div className="players-section">
          <div className="players-header">
            <h2>Players</h2>
            <span className="player-count">
              {roomInfo.players.length} / {roomInfo.maxPlayers}
            </span>
          </div>

          <div className="players-list">
            {roomInfo.players.map((player) => (
              <PlayerCard
                key={player.id}
                player={player}
                isHost={player.id === roomInfo.hostId}
                isMe={player.id === playerId}
                canKick={isHost && player.id !== playerId}
                onKick={() => onKickPlayer(player.id)}
              />
            ))}

            {/* Empty slots */}
            {Array.from({ length: roomInfo.maxPlayers - roomInfo.players.length }).map((_, i) => (
              <div key={`empty-${i}`} className="player-card empty">
                <div className="player-avatar empty-avatar">?</div>
                <div className="player-info">
                  <span className="player-name">Waiting for player...</span>
                </div>
              </div>
            ))}
          </div>
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

        {/* Start Button */}
        {isHost ? (
          <button
            className="btn btn-primary btn-lg w-full"
            onClick={handleStart}
            disabled={loading || !canStart}
          >
            {loading ? 'Starting...' : canStart ? 'Start Game' : `Need ${findNearestValidCount(roomInfo.players.length)} players`}
          </button>
        ) : (
          <div className="waiting-message">
            Waiting for host to start the game...
          </div>
        )}
      </div>
    </div>
  );
}

interface PlayerCardProps {
  player: PublicPlayer;
  isHost: boolean;
  isMe: boolean;
  canKick: boolean;
  onKick: () => void;
}

function PlayerCard({ player, isHost, isMe, canKick, onKick }: PlayerCardProps) {
  return (
    <div className={`player-card ${!player.connected ? 'disconnected' : ''}`}>
      <div
        className="player-avatar"
        style={{ backgroundColor: getTeamColorHex(player.teamColor) }}
      >
        {getTeamLetter(player.teamColor)}
      </div>
      <div className="player-info">
        <span className="player-name">
          {player.name}
          {isHost && <span className="host-badge">Host</span>}
          {isMe && <span className="me-badge">You</span>}
        </span>
        <span className="player-team">Team {player.teamIndex + 1}</span>
        {!player.connected && <span className="disconnected-badge">Disconnected</span>}
      </div>
      {canKick && (
        <button className="kick-button" onClick={onKick} title="Kick player">
          ✕
        </button>
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
