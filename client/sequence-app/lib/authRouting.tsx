import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors } from '@/theme';

export type AuthRedirectPath = '/(auth)/login' | '/(auth)/onboarding' | '/(main)/home';

export interface AuthRoutingSnapshot {
  user: object | null;
  sessionToken: string | null;
  isLoading: boolean;
  needsUsername: boolean;
  tempToken: string | null;
}

export type AuthRouteStatus = 'loading' | 'unauthenticated' | 'needsUsername' | 'authenticated';

export function getAuthRouteStatus(state: AuthRoutingSnapshot): AuthRouteStatus {
  if (state.isLoading) {
    return 'loading';
  }

  if (state.needsUsername && state.tempToken) {
    return 'needsUsername';
  }

  if (!state.sessionToken || !state.user) {
    return 'unauthenticated';
  }

  return 'authenticated';
}

export function getEntryRedirectPath(state: AuthRoutingSnapshot): AuthRedirectPath | null {
  const status = getAuthRouteStatus(state);

  if (status === 'loading') {
    return null;
  }

  if (status === 'needsUsername') {
    return '/(auth)/onboarding';
  }

  if (status === 'authenticated') {
    return '/(main)/home';
  }

  return '/(auth)/login';
}

export function getProtectedRouteRedirectPath(state: AuthRoutingSnapshot): Extract<AuthRedirectPath, '/(auth)/login' | '/(auth)/onboarding'> | null {
  const status = getAuthRouteStatus(state);

  if (status === 'loading' || status === 'authenticated') {
    return null;
  }

  if (status === 'needsUsername') {
    return '/(auth)/onboarding';
  }

  return '/(auth)/login';
}

export function AuthLoadingScreen() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
