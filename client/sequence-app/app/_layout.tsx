import { Slot, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useGameStore } from '@/stores/gameStore';
import { setupNotificationListeners, cleanupNotificationListeners } from '@/services/push';
import { registerForPushNotifications } from '@/services/push';
import { Background } from '@/components/ui/Background';

export default function RootLayout() {
  const router = useRouter();
  const { restoreSession, sessionToken } = useAuthStore();
  const setPendingRoomCode = useGameStore((state) => state.setPendingRoomCode);

  useEffect(() => {
    restoreSession();
  }, []);

  useEffect(() => {
    if (sessionToken) {
      registerForPushNotifications();
      setupNotificationListeners((roomCode) => {
        setPendingRoomCode(roomCode);
        router.push('/(main)/join-room');
      });
      return () => cleanupNotificationListeners();
    }
  }, [router, sessionToken, setPendingRoomCode]);

  return (
    <Background>
      <StatusBar style="light" />
      <Slot />
    </Background>
  );
}