import { Slot } from 'expo-router';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';
import { useGameStore } from '@/stores/gameStore';
import { setupNotificationListeners, cleanupNotificationListeners } from '@/services/push';
import { registerForPushNotifications } from '@/services/push';
import { Background } from '@/components/ui/Background';

export default function RootLayout() {
  const router = useRouter();
  const { restoreSession, sessionToken, user } = useAuthStore();
  const pendingRoomCode = useGameStore((state) => state.pendingRoomCode);

  useEffect(() => {
    restoreSession();
  }, []);

  useEffect(() => {
    if (sessionToken && user && pendingRoomCode) {
      router.replace('/(main)/join-room');
    }
  }, [pendingRoomCode, router, sessionToken, user]);

  useEffect(() => {
    if (sessionToken) {
      registerForPushNotifications();
      setupNotificationListeners((roomCode) => {
        useGameStore.getState().setPendingRoomCode(roomCode);
        router.replace('/(main)/join-room');
      });
      return () => cleanupNotificationListeners();
    }
  }, [router, sessionToken]);

  return (
    <SafeAreaProvider>
      <Background>
        <StatusBar style="light" />
        <Slot />
      </Background>
    </SafeAreaProvider>
  );
}
