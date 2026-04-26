import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { AuthLoadingScreen, getAuthRouteStatus } from '@/lib/authRouting';
import { normalizeRoomCode } from '@/lib/deepLinks';
import { useAuthStore } from '@/stores/authStore';
import { useGameStore } from '@/stores/gameStore';

export default function JoinInviteRoute() {
  const { roomCode } = useLocalSearchParams<{ roomCode?: string | string[] }>();
  const code = normalizeRoomCode(roomCode);
  const setPendingRoomCode = useGameStore((state) => state.setPendingRoomCode);
  const authState = useAuthStore(useShallow((state) => ({
    user: state.user,
    sessionToken: state.sessionToken,
    isLoading: state.isLoading,
    needsUsername: state.needsUsername,
    tempToken: state.tempToken,
  })));
  const status = getAuthRouteStatus(authState);

  useEffect(() => {
    if (code) {
      setPendingRoomCode(code);
    }
  }, [code, setPendingRoomCode]);

  if (status === 'loading') {
    return <AuthLoadingScreen />;
  }

  if (status === 'needsUsername') {
    return <Redirect href="/(auth)/onboarding" />;
  }

  if (status === 'unauthenticated') {
    return <Redirect href="/(auth)/login" />;
  }

  return <Redirect href="/(main)/join-room" />;
}
