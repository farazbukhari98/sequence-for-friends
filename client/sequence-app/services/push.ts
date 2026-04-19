import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { api } from './api';
import { getSessionToken } from './auth';

// Configure notification handler for foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let pushToken: string | null = null;
let notificationListener: Notifications.EventSubscription | null = null;
let responseListener: Notifications.EventSubscription | null = null;
let onInviteDeepLink: ((roomCode: string) => void) | null = null;

type PermissionResult = { status: string; granted: boolean };

async function getPermissionStatus(): Promise<PermissionResult> {
  const result = await Notifications.getPermissionsAsync() as unknown as PermissionResult;
  return result;
}

async function requestPermissionStatus(): Promise<PermissionResult> {
  const result = await Notifications.requestPermissionsAsync() as unknown as PermissionResult;
  return result;
}

export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6366f1',
    });
  }

  const existing = await getPermissionStatus();
  let finalStatus = existing.status;

  if (finalStatus !== 'granted') {
    const requested = await requestPermissionStatus();
    finalStatus = requested.status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'sequence-game',
    });
    pushToken = tokenData.data;

    // Register with backend
    const sessionToken = await getSessionToken();
    if (sessionToken && pushToken) {
      await api.registerPushToken(sessionToken, pushToken);
    }

    return pushToken;
  } catch (error) {
    console.error('Failed to get push token:', error);
    return null;
  }
}

export function setupNotificationListeners(
  onInvite?: (roomCode: string) => void
) {
  // Store callback for deep links
  onInviteDeepLink = onInvite ?? null;

  // Listen for notifications received while app is foregrounded
  notificationListener = Notifications.addNotificationReceivedListener((notification) => {
    console.log('Notification received:', notification.request.content);
  });

  // Listen for notification tap (foreground or background)
  responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    if (data?.roomCode) {
      onInviteDeepLink?.(data.roomCode as string);
    }
  });

  // Handle deep links when app is opened from terminated state
  Linking.addEventListener('url', (event) => {
    handleDeepLink(event.url);
  });

  // Check initial URL
  Linking.getInitialURL().then((url) => {
    if (url) handleDeepLink(url);
  });
}

function handleDeepLink(url: string) {
  // Handle sequencegame://join/{code} or sequencegame://invite/{code}
  const prefix = 'sequencegame://';
  if (!url.startsWith(prefix)) return;

  const path = url.substring(prefix.length);
  // Paths: join/{code} or invite/{code}
  const match = path.match(/^(?:join|invite)\/([A-Z0-9]+)$/i);
  if (match) {
    onInviteDeepLink?.(match[1].toUpperCase());
  }
}

export function cleanupNotificationListeners() {
  notificationListener?.remove();
  responseListener?.remove();
  onInviteDeepLink = null;
}

export function getPushToken(): string | null {
  return pushToken;
}

export async function getNotificationPermissionStatus(): Promise<'granted' | 'undetermined' | 'denied'> {
  const result = await getPermissionStatus();
  if (result.granted) return 'granted';
  if (result.status === 'denied') return 'denied';
  return 'undetermined';
}