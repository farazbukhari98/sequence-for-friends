import { Redirect, Stack } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { AuthLoadingScreen, getAuthRouteStatus, getProtectedRouteRedirectPath } from '@/lib/authRouting';
import { useShallow } from 'zustand/react/shallow';

export default function MainLayout() {
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
      <Stack.Screen name="home" />
      <Stack.Screen name="create-room" />
      <Stack.Screen name="join-room" />
      <Stack.Screen name="solo-practice" />
      <Stack.Screen name="friends" />
      <Stack.Screen name="friend-profile" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="game-history" />
      <Stack.Screen name="detailed-stats" />
    </Stack>
  );
}
