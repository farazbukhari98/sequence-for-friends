import type { ExpoConfig } from 'expo/config';

const config = {
  name: 'Sequence',
  slug: 'sequence',
  version: '2.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'sequencegame',
  userInterfaceStyle: 'dark',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0a0e1a',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.farazbukhari.sequence',
    buildNumber: '46',
    infoPlist: {
      NSAppTransportSecurity: { NSAllowsArbitraryConnections: true },
      UIBackgroundModes: ['fetch', 'remote-notification'],
    },
    usesAppleSignIn: true,
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0a0e1a',
    },
    package: 'com.farazbukhari.sequence',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-apple-authentication',
  ],
  extra: { router: { origin: false } },
} satisfies ExpoConfig;

export default config;
