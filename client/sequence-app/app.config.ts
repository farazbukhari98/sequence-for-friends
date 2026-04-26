import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Sequence',
  slug: 'sequence',
  version: '2.0.5',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'sequencegame',
  userInterfaceStyle: 'dark',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0D3B22',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.farazbukhari.sequence',
    buildNumber: '55',
    associatedDomains: [
      'applinks:sequence.wf',
      'applinks:sequence-for-friends.farazbukhari98.workers.dev',
    ],
    infoPlist: {
      NSAppTransportSecurity: { NSAllowsArbitraryConnections: true },
      UIBackgroundModes: ['fetch', 'remote-notification'],
    },
    usesAppleSignIn: true,
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0D3B22',
    },
    package: 'com.farazbukhari.sequence',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-apple-authentication',
    'expo-notifications',
  ],
  extra: { router: { origin: false } },
};

export default config;
