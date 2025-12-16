import { useState, useEffect } from 'react';
import { useSocket } from './hooks/useSocket';
import { HomeScreen } from './components/HomeScreen';
import { LobbyScreen } from './components/LobbyScreen';
import { GameScreen } from './components/GameScreen';
import { Toast } from './components/Toast';
import type { TurnTimeLimit } from '../../shared/types';

type Screen = 'home' | 'lobby' | 'game';

// Storage keys
const STORAGE_KEYS = {
  roomCode: 'sequence_room_code',
  token: 'sequence_player_token',
  playerId: 'sequence_player_id',
};

function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [playerId, setPlayerId] = useState<string | null>(null);

  const {
    connected,
    roomInfo,
    gameState,
    error,
    cutCards,
    turnTimeoutInfo,
    createRoom,
    joinRoom,
    reconnect,
    leaveRoom,
    kickPlayer,
    startGame,
    sendAction,
    updateRoomSettings,
    clearError,
  } = useSocket();

  // Check for existing session on mount
  useEffect(() => {
    const savedRoomCode = localStorage.getItem(STORAGE_KEYS.roomCode);
    const savedToken = localStorage.getItem(STORAGE_KEYS.token);

    if (savedRoomCode && savedToken && connected) {
      // Try to reconnect
      reconnect(savedRoomCode, savedToken).then((result) => {
        if ('error' in result) {
          // Clear invalid session
          localStorage.removeItem(STORAGE_KEYS.roomCode);
          localStorage.removeItem(STORAGE_KEYS.token);
          localStorage.removeItem(STORAGE_KEYS.playerId);
        } else {
          setPlayerId(result.playerId);
          if (result.gameState) {
            setScreen('game');
          } else {
            setScreen('lobby');
          }
        }
      });
    }
  }, [connected, reconnect]);

  // Update screen based on game state
  useEffect(() => {
    if (gameState && gameState.phase === 'playing') {
      setScreen('game');
    }
  }, [gameState]);

  // Save session info
  const saveSession = (roomCode: string, token: string, pid: string) => {
    localStorage.setItem(STORAGE_KEYS.roomCode, roomCode);
    localStorage.setItem(STORAGE_KEYS.token, token);
    localStorage.setItem(STORAGE_KEYS.playerId, pid);
    setPlayerId(pid);
  };

  // Clear session info
  const clearSession = () => {
    localStorage.removeItem(STORAGE_KEYS.roomCode);
    localStorage.removeItem(STORAGE_KEYS.token);
    localStorage.removeItem(STORAGE_KEYS.playerId);
    setPlayerId(null);
  };

  // Handle creating a room
  const handleCreateRoom = async (playerName: string, maxPlayers: number, teamCount: number, turnTimeLimit: TurnTimeLimit) => {
    const result = await createRoom(playerName, maxPlayers, teamCount, turnTimeLimit);
    if ('error' in result) {
      return result;
    }
    saveSession(result.roomCode, result.token, result.playerId);
    setScreen('lobby');
    return result;
  };

  // Handle joining a room
  const handleJoinRoom = async (roomCode: string, playerName: string) => {
    const result = await joinRoom(roomCode, playerName);
    if ('error' in result) {
      return result;
    }
    saveSession(roomCode.toUpperCase(), result.token, result.playerId);
    setScreen('lobby');
    return result;
  };

  // Handle leaving a room
  const handleLeaveRoom = () => {
    leaveRoom();
    clearSession();
    setScreen('home');
  };

  // Handle starting the game
  const handleStartGame = async () => {
    const result = await startGame();
    if (result.success) {
      setScreen('game');
    }
    return result;
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {!connected && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50
        }}>
          <div style={{ textAlign: 'center' }}>
            <div className="animate-pulse" style={{ color: 'var(--accent-primary)', fontSize: '1.25rem', marginBottom: '0.5rem' }}>
              Connecting...
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Please wait
            </div>
          </div>
        </div>
      )}

      {screen === 'home' && (
        <HomeScreen
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
        />
      )}

      {screen === 'lobby' && roomInfo && playerId && (
        <LobbyScreen
          roomInfo={roomInfo}
          playerId={playerId}
          onLeave={handleLeaveRoom}
          onKickPlayer={kickPlayer}
          onStartGame={handleStartGame}
          onUpdateSettings={updateRoomSettings}
        />
      )}

      {screen === 'game' && gameState && playerId && (
        <GameScreen
          gameState={gameState}
          playerId={playerId}
          cutCards={cutCards}
          turnTimeoutInfo={turnTimeoutInfo}
          onAction={sendAction}
          onLeave={handleLeaveRoom}
        />
      )}

      {error && (
        <Toast
          message={error}
          type="error"
          onClose={clearError}
        />
      )}
    </div>
  );
}

export default App;
