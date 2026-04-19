import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { setupNotificationListeners, cleanupNotificationListeners } from '@/services/push';
import { registerForPushNotifications } from '@/services/push';
import { Background } from '@/components/ui/Background';

export default function RootLayout() {
  const { restoreSession, sessionToken } = useAuthStore();

  useEffect(() => {
    restoreSession();
  }, []);

  useEffect(() => {
    if (sessionToken) {
      registerForPushNotifications();
      setupNotificationListeners((roomCode) => {
        // Handle deep link invite — could navigate to join room
        console.log('Invite deep link:', roomCode);
      });
      return () => cleanupNotificationListeners();
    }
  }, [sessionToken]);

  return (
    <Background>
      <StatusBar style="light" />
      <Slot />
    </Background>
  );
}