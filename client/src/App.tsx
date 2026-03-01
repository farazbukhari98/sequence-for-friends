import { useState, useEffect, useCallback, useRef } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useSocket } from './hooks/useSocket';
import { useAuth } from './hooks/useAuth';
import { usePush } from './hooks/usePush';
import { AuthScreen } from './redesign/components/AuthScreen';
import { OnboardingScreen } from './redesign/components/OnboardingScreen';
import { HomeScreen } from './redesign/components/HomeScreen';
import { LobbyScreen } from './redesign/components/LobbyScreen';
import { GameScreen } from './redesign/components/GameScreen';
import { ProfileScreen } from './redesign/components/ProfileScreen';
import { FriendsScreen } from './redesign/components/FriendsScreen';
import { Toast } from './components/Toast';
import type { TurnTimeLimit, SequencesToWin, BotDifficulty, SequenceLength } from '../../shared/types';

type Screen = 'auth' | 'onboarding' | 'home' | 'profile' | 'friends' | 'lobby' | 'game';

// Storage keys
const STORAGE_KEYS = {
  roomCode: 'sequence_room_code',
  token: 'sequence_player_token',
  playerId: 'sequence_player_id',
};

// Get room code from URL
function getRoomCodeFromURL(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('room') || params.get('code') || null;
}

function App() {
  const [screen, setScreen] = useState<Screen>('auth');
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [urlRoomCode, setUrlRoomCode] = useState<string | null>(getRoomCodeFromURL);
  const [showReconnectOverlay, setShowReconnectOverlay] = useState(false);
  const overlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Onboarding state
  const [onboardingTempToken, setOnboardingTempToken] = useState<string | null>(null);
  const [onboardingSuggestedName, setOnboardingSuggestedName] = useState<string | undefined>();

  // Auth
  const { user, loading: authLoading, isAuthenticated, signIn, completeRegistration, signOut, updateUser } = useAuth();

  // Push notifications
  usePush({
    isAuthenticated,
    onInvite: (roomCode) => {
      setUrlRoomCode(roomCode);
      setScreen('home');
    },
  });

  const {
    connected,
    roomInfo,
    gameState,
    error,
    cutCards,
    turnTimeoutInfo,
    teamSwitchRequest,
    teamSwitchResponse,
    gameModeInfo,
    roomClosed,
    createRoom,
    createBotGame,
    joinRoom,
    reconnect,
    leaveRoom,
    kickPlayer,
    addBot,
    startGame,
    sendAction,
    updateRoomSettings,
    toggleReady,
    requestTeamSwitch,
    respondTeamSwitch,
    continueSeries,
    endSeries,
    clearError,
    clearTeamSwitchRequest,
    clearGameModeInfo,
    clearRoomClosed,
  } = useSocket();

  // Set initial screen based on auth state
  useEffect(() => {
    if (authLoading) return;
    if (isAuthenticated) {
      if (screen === 'auth' || screen === 'onboarding') {
        setScreen('home');
      }
    } else {
      setScreen('auth');
    }
  }, [authLoading, isAuthenticated]);

  // On mount, try to restore an existing session instead of clearing it.
  // If credentials exist and user is authenticated, attempt reconnection.
  // Session is cleared explicitly on room-closed or intentional leave.
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      // Not authenticated — clear any stale session
      localStorage.removeItem(STORAGE_KEYS.roomCode);
      localStorage.removeItem(STORAGE_KEYS.token);
      localStorage.removeItem(STORAGE_KEYS.playerId);
      return;
    }

    const savedRoom = localStorage.getItem(STORAGE_KEYS.roomCode);
    const savedToken = localStorage.getItem(STORAGE_KEYS.token);
    const savedPlayerId = localStorage.getItem(STORAGE_KEYS.playerId);

    if (savedRoom && savedToken && savedPlayerId) {
      setPlayerId(savedPlayerId);
      reconnect(savedRoom, savedToken).then((result) => {
        if ('error' in result) {
          // Reconnect failed — stale session, clear it
          clearSession();
        } else {
          setPlayerId(result.playerId);
          // Navigate to the correct screen based on game state
          if (result.gameState && result.gameState.phase === 'playing') {
            setScreen('game');
          } else {
            setScreen('lobby');
          }
        }
      });
    }
  }, [authLoading, isAuthenticated]);

  // Listen for deep links (Universal Links / App Links)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listener = CapApp.addListener('appUrlOpen', (event) => {
      try {
        // Handle custom scheme: sequencegame://join/CODE
        if (event.url.startsWith('sequencegame://')) {
          const path = event.url.replace('sequencegame://', '');
          const joinMatch = path.match(/^join\/([A-Za-z0-9]+)/);
          if (joinMatch) {
            const code = joinMatch[1].toUpperCase();
            setUrlRoomCode(code);
            if (isAuthenticated) setScreen('home');
          }
          return;
        }
        // Handle Universal Links: https://...
        const url = new URL(event.url);
        const joinMatch = url.pathname.match(/^\/join\/([A-Za-z0-9]+)/);
        if (joinMatch) {
          const code = joinMatch[1].toUpperCase();
          setUrlRoomCode(code);
          if (isAuthenticated) setScreen('home');
          return;
        }
        const roomParam = url.searchParams.get('room') || url.searchParams.get('code');
        if (roomParam) {
          setUrlRoomCode(roomParam.toUpperCase());
          if (isAuthenticated) setScreen('home');
        }
      } catch {
        // Invalid URL, ignore
      }
    });

    return () => {
      listener.then(l => l.remove());
    };
  }, [isAuthenticated]);

  // Update screen based on game state
  useEffect(() => {
    if (gameState && gameState.phase === 'playing') {
      setScreen('game');
    }
  }, [gameState]);

  // Handle room closed (host left or ended game)
  useEffect(() => {
    if (roomClosed) {
      clearSession();
      setScreen('home');
      clearRoomClosed();
    }
  }, [roomClosed, clearRoomClosed]);

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

  // Handle creating a room (uses display name from user profile)
  const handleCreateRoom = async (roomName: string, playerName: string, maxPlayers: number, teamCount: number, turnTimeLimit: TurnTimeLimit, sequencesToWin: SequencesToWin) => {
    const name = user?.displayName || playerName;
    const result = await createRoom(roomName, name, maxPlayers, teamCount, turnTimeLimit, sequencesToWin);
    if ('error' in result) {
      return result;
    }
    saveSession(result.roomCode, result.token, result.playerId);
    setScreen('lobby');
    return result;
  };

  // Handle creating a bot game
  const handleCreateBotGame = async (playerName: string, difficulty: BotDifficulty, sequenceLength?: SequenceLength) => {
    const name = user?.displayName || playerName;
    const result = await createBotGame(name, difficulty, sequenceLength);
    if ('error' in result) {
      return result;
    }
    saveSession(result.roomCode, result.token, result.playerId);
    setScreen('game');
    return result;
  };

  // Handle joining a room
  const handleJoinRoom = async (roomCode: string, playerName: string) => {
    const name = user?.displayName || playerName;
    const result = await joinRoom(roomCode, name);
    if ('error' in result) {
      return result;
    }
    saveSession(roomCode.toUpperCase(), result.token, result.playerId);
    if (urlRoomCode) {
      window.history.replaceState({}, '', window.location.pathname);
    }
    setScreen('lobby');
    return result;
  };

  // Clear URL room code (e.g., when user backs out of join screen)
  const handleClearUrlRoomCode = useCallback(() => {
    setUrlRoomCode(null);
    window.history.replaceState({}, '', window.location.pathname);
  }, []);

  // Handle leaving a room
  const handleLeaveRoom = () => {
    leaveRoom();
    clearSession();
    setScreen('home');
  };

  // Return to lobby without leaving the room (used after series ends)
  const handleReturnToLobby = useCallback(() => {
    setScreen('lobby');
  }, []);

  // Auto-transition from game to lobby when room phase changes
  const prevRoomPhaseRef = useRef(roomInfo?.phase);
  useEffect(() => {
    const prevPhase = prevRoomPhaseRef.current;
    const currentPhase = roomInfo?.phase;
    prevRoomPhaseRef.current = currentPhase;

    if (prevPhase === 'in-game' && currentPhase === 'waiting') {
      const seriesJustWon = roomInfo?.seriesState?.seriesWinnerTeamIndex != null;
      if (!seriesJustWon) {
        setScreen('lobby');
      }
    }
  }, [roomInfo]);

  // Delay showing reconnect overlay
  useEffect(() => {
    if (!connected && screen !== 'home' && screen !== 'auth' && screen !== 'onboarding' && screen !== 'profile' && screen !== 'friends') {
      overlayTimerRef.current = setTimeout(() => {
        setShowReconnectOverlay(true);
      }, 1500);
    } else {
      if (overlayTimerRef.current) {
        clearTimeout(overlayTimerRef.current);
        overlayTimerRef.current = null;
      }
      setShowReconnectOverlay(false);
    }
    return () => {
      if (overlayTimerRef.current) {
        clearTimeout(overlayTimerRef.current);
      }
    };
  }, [connected, screen]);

  // Handle starting the game
  const handleStartGame = async () => {
    const result = await startGame();
    if (result.success) {
      setScreen('game');
    }
    return result;
  };

  // Auth handlers
  const handleSignIn = async () => {
    return signIn();
  };

  const handleNeedsUsername = (tempToken: string, suggestedName?: string) => {
    setOnboardingTempToken(tempToken);
    setOnboardingSuggestedName(suggestedName);
    setScreen('onboarding');
  };

  const handleCompleteRegistration = async (username: string, displayName: string, avatarId: string, avatarColor: string) => {
    if (!onboardingTempToken) return { error: 'Missing registration token' };
    const result = await completeRegistration(onboardingTempToken, username, displayName, avatarId, avatarColor);
    if (!result.error) {
      setScreen('home');
    }
    return result;
  };

  const handleSignOut = async () => {
    await signOut();
    clearSession();
    setScreen('auth');
  };

  // Loading state
  if (authLoading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050505' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="logo-icon" style={{ margin: '0 auto 12px' }}>
            <span className="logo-s" style={{ fontSize: '2rem', color: '#fff' }}>S</span>
          </div>
          <p style={{ color: '#888' }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {showReconnectOverlay && (
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
              Reconnecting...
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Please wait
            </div>
          </div>
        </div>
      )}

      {screen === 'auth' && (
        <AuthScreen
          onSignIn={handleSignIn}
          onNeedsUsername={handleNeedsUsername}
        />
      )}

      {screen === 'onboarding' && (
        <OnboardingScreen
          suggestedName={onboardingSuggestedName}
          onComplete={handleCompleteRegistration}
        />
      )}

      {screen === 'home' && (
        <HomeScreen
          onCreateRoom={handleCreateRoom}
          onCreateBotGame={handleCreateBotGame}
          onJoinRoom={handleJoinRoom}
          initialRoomCode={urlRoomCode || undefined}
          onClearRoomCode={handleClearUrlRoomCode}
          user={user || undefined}
          onProfilePress={() => setScreen('profile')}
          onFriendsPress={() => setScreen('friends')}
        />
      )}

      {screen === 'profile' && user && (
        <ProfileScreen
          user={user}
          onBack={() => setScreen('home')}
          onSignOut={handleSignOut}
          onUpdateUser={updateUser}
        />
      )}

      {screen === 'friends' && (
        <FriendsScreen
          onBack={() => setScreen('home')}
        />
      )}

      {screen === 'lobby' && roomInfo && playerId && (
        <LobbyScreen
          roomInfo={roomInfo}
          playerId={playerId}
          teamSwitchRequest={teamSwitchRequest}
          teamSwitchResponse={teamSwitchResponse}
          gameModeInfo={gameModeInfo}
          onLeave={handleLeaveRoom}
          onKickPlayer={kickPlayer}
          onAddBot={addBot}
          onStartGame={handleStartGame}
          onUpdateSettings={updateRoomSettings}
          onToggleReady={toggleReady}
          onRequestTeamSwitch={requestTeamSwitch}
          onRespondTeamSwitch={respondTeamSwitch}
          onClearTeamSwitchRequest={clearTeamSwitchRequest}
          onClearGameModeInfo={clearGameModeInfo}
          isAuthenticated={isAuthenticated}
        />
      )}

      {screen === 'game' && gameState && playerId && (
        <GameScreen
          gameState={gameState}
          playerId={playerId}
          cutCards={cutCards}
          turnTimeoutInfo={turnTimeoutInfo}
          roomInfo={roomInfo}
          onAction={sendAction}
          onLeave={handleLeaveRoom}
          onContinueSeries={continueSeries}
          onEndSeries={endSeries}
          onReturnToLobby={handleReturnToLobby}
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
