import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import type { PluginListenerHandle } from '@capacitor/core';
import { api } from '../lib/api';

interface UsePushOptions {
  isAuthenticated: boolean;
  onInvite?: (roomCode: string) => void;
}

export function usePush({ isAuthenticated, onInvite }: UsePushOptions): void {
  const onInviteRef = useRef(onInvite);
  onInviteRef.current = onInvite;

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !isAuthenticated) return;

    let registrationListener: PluginListenerHandle | null = null;
    let actionListener: PluginListenerHandle | null = null;
    let foregroundListener: PluginListenerHandle | null = null;

    const setup = async () => {
      try {
        const perm = await PushNotifications.requestPermissions();
        if (perm.receive !== 'granted') return;

        await PushNotifications.register();

        registrationListener = await PushNotifications.addListener('registration', async (token) => {
          try {
            await api.registerPush(token.value);
          } catch {}
        });

        // Handle taps on notifications (background or cold-launch)
        actionListener = await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
          const data = notification.notification.data;
          if (data?.type === 'game_invite' && data?.roomCode) {
            onInviteRef.current?.(data.roomCode);
          }
        });

        // Handle notifications received while app is in foreground
        foregroundListener = await PushNotifications.addListener('pushNotificationReceived', (notification) => {
          // Foreground notifications are silently received on iOS.
          // We could show an in-app banner here if needed.
          console.log('Foreground push received:', notification.data);
        });

        // Check for notifications that launched the app (cold start)
        const delivered = await PushNotifications.getDeliveredNotifications();
        if (delivered.notifications.length > 0) {
          const first = delivered.notifications[0];
          const data = first.data as Record<string, string> | undefined;
          if (data?.type === 'game_invite' && data?.roomCode) {
            onInviteRef.current?.(data.roomCode);
          }
          await PushNotifications.removeAllDeliveredNotifications();
        }
      } catch (err) {
        console.error('Push setup failed:', err);
      }
    };

    setup();

    return () => {
      registrationListener?.remove();
      actionListener?.remove();
      foregroundListener?.remove();
    };
  }, [isAuthenticated]);
}
