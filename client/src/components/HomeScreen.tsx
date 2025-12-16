import { useState } from 'react';
import { VALID_PLAYER_COUNTS, TURN_TIME_OPTIONS, TurnTimeLimit } from '../../../shared/types';
import './HomeScreen.css';

interface HomeScreenProps {
  onCreateRoom: (roomName: string, playerName: string, maxPlayers: number, teamCount: number, turnTimeLimit: TurnTimeLimit) => Promise<{ roomCode?: string; playerId?: string; token?: string; error?: string }>;
  onJoinRoom: (roomCode: string, playerName: string) => Promise<{ roomInfo?: unknown; playerId?: string; token?: string; error?: string }>;
}

export function HomeScreen({ onCreateRoom, onJoinRoom }: HomeScreenProps) {
  const [mode, setMode] = useState<'home' | 'create' | 'join'>('home');
  const [roomName, setRoomName] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [turnTimeLimit, setTurnTimeLimit] = useState<TurnTimeLimit>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }

    setLoading(true);
    setError(null);

    // Determine team count based on player count
    const teamCount = maxPlayers <= 3 ? maxPlayers : (maxPlayers % 2 === 0 ? 2 : 3);

    // Use room name if provided, otherwise default will be set by server
    const result = await onCreateRoom(roomName.trim(), playerName.trim(), maxPlayers, teamCount, turnTimeLimit);
    setLoading(false);

    if (result.error) {
      setError(result.error);
    }
  };

  const handleJoin = async () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!roomCode.trim()) {
      setError('Please enter a room code');
      return;
    }

    setLoading(true);
    setError(null);

    const result = await onJoinRoom(roomCode.trim().toUpperCase(), playerName.trim());
    setLoading(false);

    if (result.error) {
      setError(result.error);
    }
  };

  const renderHome = () => (
    <div className="home-content animate-fade-in">
      <div className="home-logo">
        <div className="logo-icon">
          <span className="logo-s">S</span>
          <div className="logo-chips">
            <span className="chip chip-blue"></span>
            <span className="chip chip-green"></span>
          </div>
        </div>
        <h1 className="logo-title">Sequence</h1>
        <p className="logo-subtitle">Play with Friends</p>
      </div>

      <div className="home-buttons">
        <button
          className="btn btn-primary btn-lg w-full"
          onClick={() => setMode('create')}
        >
          Create Game
        </button>
        <button
          className="btn btn-secondary btn-lg w-full"
          onClick={() => setMode('join')}
        >
          Join Game
        </button>
      </div>

      <div className="home-footer">
        <p>The classic card-sequence board game</p>
      </div>
    </div>
  );

  const renderCreate = () => (
    <div className="home-content animate-fade-in">
      <button className="back-button" onClick={() => { setMode('home'); setError(null); }}>
        ← Back
      </button>

      <h2>Create Game</h2>

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

      <div className="form-group">
        <label htmlFor="players">Number of Players</label>
        <div className="player-count-grid">
          {VALID_PLAYER_COUNTS.map((count) => (
            <button
              key={count}
              className={`player-count-btn ${maxPlayers === count ? 'active' : ''}`}
              onClick={() => setMaxPlayers(count)}
            >
              {count}
            </button>
          ))}
        </div>
        <p className="form-hint">
          {maxPlayers <= 3
            ? `${maxPlayers} individual players`
            : `${maxPlayers} players in ${maxPlayers % 2 === 0 ? '2' : '3'} teams`}
        </p>
      </div>

      <div className="form-group">
        <label htmlFor="turnTimeLimit">Turn Time Limit</label>
        <div className="time-limit-grid">
          {TURN_TIME_OPTIONS.map((option) => (
            <button
              key={option.value}
              className={`time-limit-btn ${turnTimeLimit === option.value ? 'active' : ''}`}
              onClick={() => setTurnTimeLimit(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="form-hint">
          {turnTimeLimit === 0
            ? 'Players can take as long as they want'
            : `Players have ${turnTimeLimit} seconds per turn`}
        </p>
      </div>

      {error && <div className="form-error">{error}</div>}

      <button
        className="btn btn-primary btn-lg w-full"
        onClick={handleCreate}
        disabled={loading}
      >
        {loading ? 'Creating...' : 'Create Room'}
      </button>
    </div>
  );

  const renderJoin = () => (
    <div className="home-content animate-fade-in">
      <button className="back-button" onClick={() => { setMode('home'); setError(null); }}>
        ← Back
      </button>

      <h2>Join Game</h2>

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
          className="room-code-input"
        />
      </div>

      {error && <div className="form-error">{error}</div>}

      <button
        className="btn btn-primary btn-lg w-full"
        onClick={handleJoin}
        disabled={loading}
      >
        {loading ? 'Joining...' : 'Join Room'}
      </button>
    </div>
  );

  return (
    <div className="home-screen">
      {mode === 'home' && renderHome()}
      {mode === 'create' && renderCreate()}
      {mode === 'join' && renderJoin()}
    </div>
  );
}
