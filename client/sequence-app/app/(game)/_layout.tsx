import { Redirect, Stack } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { AuthLoadingScreen, getAuthRouteStatus, getProtectedRouteRedirectPath } from '@/lib/authRouting';
import { useShallow } from 'zustand/react/shallow';

export default function GameLayout() {
  const authState = useAuthStore(useShallow((state) => ({
    user: state.user,
    sessionToken: state.sessionToken,
    isLoading: state.isLoading,
    needsUsername: state.needsUsername,
    tempToken: state.tempToken,
  })));
  const status = getAuthRouteStatus(authState);
  const redirectPath = getProtectedRouteRedirectPath(authState);

  if (status === 'loading') {
    return <AuthLoadingScreen />;
  }

  if (redirectPath) {
    return <Redirect href={redirectPath} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="lobby" />
      <Stack.Screen name="game" />
      <Stack.Screen name="results" />
    </Stack>
  );
}
