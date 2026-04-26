import { Redirect, Stack, useSegments } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { AuthLoadingScreen, getAuthRouteStatus } from '@/lib/authRouting';
import { useShallow } from 'zustand/react/shallow';

export default function AuthLayout() {
  const segments = useSegments();
  const currentScreen = segments[segments.length - 1];
  const authState = useAuthStore(useShallow((state) => ({
    user: state.user,
    sessionToken: state.sessionToken,
    isLoading: state.isLoading,
    needsUsername: state.needsUsername,
    tempToken: state.tempToken,
  })));
  const status = getAuthRouteStatus(authState);

  if (status === 'loading') {
    return <AuthLoadingScreen />;
  }

  if (status === 'authenticated') {
    return <Redirect href="/(main)/home" />;
  }

  if (status === 'needsUsername' && currentScreen !== 'onboarding') {
    return <Redirect href="/(auth)/onboarding" />;
  }

  if (status === 'unauthenticated' && currentScreen !== 'login') {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="onboarding" />
    </Stack>
  );
}
