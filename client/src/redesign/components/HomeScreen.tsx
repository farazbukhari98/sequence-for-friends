import { useState, useEffect } from 'react';
import { VALID_PLAYER_COUNTS, TURN_TIME_OPTIONS, SEQUENCES_TO_WIN_OPTIONS, SERIES_LENGTH_OPTIONS, TurnTimeLimit, SequencesToWin, DEFAULT_SEQUENCES_TO_WIN, BotDifficulty, SequenceLength, SeriesLength, DEFAULT_SEQUENCE_LENGTH, DEFAULT_SERIES_LENGTH } from '../../../../shared/types';
import type { UserProfile } from '../../../../shared/types';
import { getAvatarEmoji } from '../../lib/avatars';
import './HomeScreen.css';

interface HomeScreenProps {
  onCreateRoom: (roomName: string, playerName: string, maxPlayers: number, teamCount: number, turnTimeLimit: TurnTimeLimit, sequencesToWin: SequencesToWin) => Promise<{ roomCode?: string; playerId?: string; token?: string; error?: string }>;
  onCreateBotGame: (playerName: string, difficulty: BotDifficulty, sequenceLength?: SequenceLength, sequencesToWin?: SequencesToWin, seriesLength?: SeriesLength) => Promise<{ roomCode?: string; playerId?: string; token?: string; error?: string }>;
  onJoinRoom: (roomCode: string, playerName: string) => Promise<{ roomInfo?: unknown; playerId?: string; token?: string; error?: string }>;
  initialRoomCode?: string;
  onClearRoomCode?: () => void;
  user?: UserProfile;
  onProfilePress?: () => void;
  onFriendsPress?: () => void;
}

export function HomeScreen({ onCreateRoom, onCreateBotGame, onJoinRoom, initialRoomCode, onClearRoomCode, user, onProfilePress, onFriendsPress }: HomeScreenProps) {
  const [mode, setMode] = useState<'home' | 'create' | 'join' | 'bot'>('home');
  const [roomName, setRoomName] = useState('');
  const [playerName, setPlayerName] = useState(user?.displayName || '');
  const [roomCode, setRoomCode] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [turnTimeLimit, setTurnTimeLimit] = useState<TurnTimeLimit>(0);
  const [sequencesToWin, setSequencesToWin] = useState<SequencesToWin>(DEFAULT_SEQUENCES_TO_WIN);
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>('medium');
  const [botSequenceLength, setBotSequenceLength] = useState<SequenceLength>(DEFAULT_SEQUENCE_LENGTH);
  const [botSequencesToWin, setBotSequencesToWin] = useState<SequencesToWin>(DEFAULT_SEQUENCES_TO_WIN);
  const [botSeriesLength, setBotSeriesLength] = useState<SeriesLength>(DEFAULT_SERIES_LENGTH);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If initialRoomCode is provided, go directly to join screen
  useEffect(() => {
    if (initialRoomCode) {
      setRoomCode(initialRoomCode.toUpperCase());
      setMode('join');
    }
  }, [initialRoomCode]);

  const handleCreate = async () => {
    const name = user?.displayName || playerName.trim();
    if (!name) {
      setError('Please enter your name');
      return;
    }

    setLoading(true);
    setError(null);

    // Determine team count based on player count
    const teamCount = maxPlayers <= 3 ? maxPlayers : (maxPlayers % 2 === 0 ? 2 : 3);

    // Use room name if provided, otherwise default will be set by server
    const result = await onCreateRoom(roomName.trim(), name, maxPlayers, teamCount, turnTimeLimit, sequencesToWin);
    setLoading(false);

    if (result.error) {
      setError(result.error);
    }
  };

  const handleJoin = async () => {
    const name = user?.displayName || playerName.trim();
    if (!name) {
      setError('Please enter your name');
      return;
    }
    if (!roomCode.trim()) {
      setError('Please enter a room code');
      return;
    }

    setLoading(true);
    setError(null);

    const result = await onJoinRoom(roomCode.trim().toUpperCase(), name);
    setLoading(false);

    if (result.error) {
      setError(result.error);
    }
  };

  const handleBotGame = async () => {
    const name = user?.displayName || playerName.trim();
    if (!name) {
      setError('Please enter your name');
      return;
    }

    setLoading(true);
    setError(null);

    const result = await onCreateBotGame(name, botDifficulty, botSequenceLength, botSequencesToWin, botSeriesLength);
    setLoading(false);

    if (result.error) {
      setError(result.error);
    }
  };

  const handleBack = () => {
    setMode('home');
    setError(null);
    onClearRoomCode?.();
  };

  const renderHome = () => (
    <div className="home-content animate-fade-in">
      {user && (
        <div className="home-top-bar">
          <button className="home-profile-btn" onClick={onProfilePress}>
            <span className="home-profile-avatar" style={{ backgroundColor: user.avatarColor }}>
              {getAvatarEmoji(user.avatarId)}
            </span>
          </button>
          <button className="home-friends-btn" onClick={onFriendsPress}>
            Friends
          </button>
        </div>
      )}

      <div className="home-logo">
        <div className="logo-icon">
          <span className="logo-s">S</span>
          <div className="logo-chips">
            <span className="chip chip-blue"></span>
            <span className="chip chip-green"></span>
            <span className="chip chip-red"></span>
          </div>
        </div>
        <h1 className="logo-title">Sequence</h1>
        <p className="logo-subtitle">Classic Edition</p>
      </div>

      <div className="home-buttons">
        <button
          className="btn btn-primary btn-lg w-full"
          onClick={() => setMode('create')}
        >
          Create Game
        </button>
        <button
          className="btn btn-bot btn-lg w-full"
          onClick={() => setMode('bot')}
        >
          Play vs Bot
        </button>
        <button
          className="btn btn-secondary btn-lg w-full"
          onClick={() => setMode('join')}
        >
          Join Game
        </button>
      </div>

      <div className="home-footer text-center">
        <p>The classic card-sequence board game</p>
      </div>
    </div>
  );

  const renderCreate = () => (
    <div className="home-content animate-fade-in">
      <div className="form-container create-mode">
        <button className="back-button" onClick={handleBack}>
          ← Back
        </button>

        <h2>Create Game</h2>

        <div className="flex flex-col gap-md mt-md">
          <div className="form-group">
            <label htmlFor="roomName">Room Name</label>
            <input
              id="roomName"
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="e.g., Friday Night Game"
              maxLength={30}
              autoComplete="off"
            />
            <p className="form-hint">Optional - defaults to "[Your Name]'s Game"</p>
          </div>

          {!user && (
            <div className="form-group">
              <label htmlFor="name">Your Name</label>
              <input
                id="name"
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name"
                maxLength={20}
                autoComplete="off"
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="players">Number of Players</label>
            <div className="player-count-grid">
              {VALID_PLAYER_COUNTS.map((count) => (
                <button
                  key={count}
                  className={"player-count-btn " + (maxPlayers === count ? 'active' : '')}
                  onClick={() => setMaxPlayers(count)}
                >
                  {count}
                </button>
              ))}
            </div>
            <p className="form-hint mt-sm">
              {maxPlayers <= 3
                ? maxPlayers + ' individual players'
                : maxPlayers + ' players in ' + (maxPlayers % 2 === 0 ? '2' : '3') + ' teams'}
            </p>
          </div>

          <div className="form-group">
            <label htmlFor="sequencesToWin">Sequences to Win</label>
            <div className="sequences-to-win-grid">
              {SEQUENCES_TO_WIN_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  className={"sequences-btn " + (sequencesToWin === option.value ? 'active' : '')}
                  onClick={() => setSequencesToWin(option.value)}
                >
                  {option.value}
                </button>
              ))}
            </div>
            <p className="form-hint mt-sm">
              First team to complete {sequencesToWin} sequence{sequencesToWin > 1 ? 's' : ''} wins
            </p>
          </div>

          <div className="form-group">
            <label htmlFor="turnTimeLimit">Turn Time Limit</label>
            <div className="time-limit-grid">
              {TURN_TIME_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  className={"time-limit-btn " + (turnTimeLimit === option.value ? 'active' : '')}
                  onClick={() => setTurnTimeLimit(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="form-hint mt-sm">
              {turnTimeLimit === 0
                ? 'Players can take as long as they want'
                : 'Players have ' + turnTimeLimit + ' seconds per turn'}
            </p>
          </div>

          {error && <div className="form-error p-md">{error}</div>}

          <button
            className="btn btn-primary btn-lg w-full mt-md"
            onClick={handleCreate}
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create Room'}
          </button>
        </div>
      </div>
    </div>
  );

  const renderJoin = () => (
    <div className="home-content animate-fade-in">
      <div className="form-container join-mode">
        <button className="back-button" onClick={handleBack}>
          ← Back
        </button>

        <h2>Join Game</h2>

        <div className="flex flex-col gap-lg mt-md">
          {initialRoomCode && (
            <div className="invite-banner p-md text-center">
              You've been invited to join a game!
            </div>
          )}

          {!user && (
            <div className="form-group">
              <label htmlFor="name">Your Name</label>
              <input
                id="name"
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name"
                maxLength={20}
                autoComplete="off"
                autoFocus={!!initialRoomCode}
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="code">Room Code</label>
            <input
              id="code"
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="Enter room code"
              maxLength={6}
              autoComplete="off"
              className="room-code-input text-center"
              readOnly={!!initialRoomCode}
            />
          </div>

          {error && <div className="form-error p-md">{error}</div>}

          <button
            className="btn btn-primary btn-lg w-full mt-md"
            onClick={handleJoin}
            disabled={loading}
          >
            {loading ? 'Joining...' : 'Join Room'}
          </button>
        </div>
      </div>
    </div>
  );

  const renderBotSetup = () => (
    <div className="home-content animate-fade-in">
      <div className="form-container bot-mode">
        <button className="back-button" onClick={handleBack}>
          &larr; Back
        </button>

        <h2>Play vs Bot</h2>

        <div className="flex flex-col gap-lg mt-md">
          {!user && (
            <div className="form-group">
              <label htmlFor="name">Your Name</label>
              <input
                id="name"
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name"
                maxLength={20}
                autoComplete="off"
              />
            </div>
          )}

          <div className="form-group">
            <label>Difficulty</label>
            <div className="difficulty-grid">
              {(['easy', 'medium', 'hard', 'impossible'] as BotDifficulty[]).map((diff) => (
                <button
                  key={diff}
                  className={`difficulty-btn ${botDifficulty === diff ? 'active' : ''} difficulty-${diff}`}
                  onClick={() => setBotDifficulty(diff)}
                >
                  <span className="difficulty-label">{diff.charAt(0).toUpperCase() + diff.slice(1)}</span>
                  <span className="difficulty-desc">
                    {diff === 'easy' ? 'Simple moves' : diff === 'medium' ? 'Smarter plays \u00b7 30s timer' : diff === 'hard' ? 'Tough opponent \u00b7 20s timer' : 'Ruthless AI \u00b7 15s timer'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Game Mode</label>
            <div className="difficulty-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <button
                className={`difficulty-btn ${botSequenceLength === 5 ? 'active' : ''}`}
                onClick={() => setBotSequenceLength(5)}
              >
                <span className="difficulty-label">Standard</span>
                <span className="difficulty-desc">5 in a row</span>
              </button>
              <button
                className={`difficulty-btn ${botSequenceLength === 4 ? 'active' : ''}`}
                onClick={() => setBotSequenceLength(4)}
              >
                <span className="difficulty-label">Blitz</span>
                <span className="difficulty-desc">4 in a row</span>
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Sequences to Win</label>
            <div className="sequences-to-win-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              {SEQUENCES_TO_WIN_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  className={"sequences-btn " + (botSequencesToWin === option.value ? 'active' : '')}
                  onClick={() => setBotSequencesToWin(option.value)}
                >
                  {option.value}
                </button>
              ))}
            </div>
            <p className="form-hint mt-sm">
              First to complete {botSequencesToWin} sequence{botSequencesToWin > 1 ? 's' : ''} wins
            </p>
          </div>

          <div className="form-group">
            <label>Series</label>
            <div className="difficulty-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              {SERIES_LENGTH_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  className={`difficulty-btn ${botSeriesLength === option.value ? 'active' : ''}`}
                  onClick={() => setBotSeriesLength(option.value)}
                >
                  <span className="difficulty-label">{option.value === 0 ? 'Single' : `Bo${option.value}`}</span>
                  <span className="difficulty-desc">{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          {error && <div className="form-error p-md">{error}</div>}

          <button
            className="btn btn-primary btn-lg w-full mt-md"
            onClick={handleBotGame}
            disabled={loading}
          >
            {loading ? 'Starting...' : 'Start Game'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="home-screen">
      {mode === 'home' && renderHome()}
      {mode === 'create' && renderCreate()}
      {mode === 'join' && renderJoin()}
      {mode === 'bot' && renderBotSetup()}
    </div>
  );
}
