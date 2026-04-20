import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Redirect } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { Background, Logo } from '@/components/ui/Background';
import { Toast } from '@/components/ui/Toast';
import { colors, spacing, fontSize, fontWeight, radius } from '@/theme';

export default function LoginScreen() {
  const { signIn, isLoading, errorMessage, clearError, sessionToken, user, needsUsername } = useAuthStore();
  const [isAppleAvailable, setIsAppleAvailable] = React.useState(false);

  React.useEffect(() => {
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync().then(setIsAppleAvailable).catch(() => setIsAppleAvailable(false));
    }
  }, []);

  if (isLoading) {
    return (
      <Background style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </Background>
    );
  }

  if (needsUsername) {
    return <Redirect href="/(auth)/onboarding" />;
  }

  if (sessionToken && user) {
    return <Redirect href="/(main)/home" />;
  }

  return (
    <Background style={styles.container}>
      <Toast message={errorMessage} onDismiss={clearError} />

      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Logo size="large" />
        </View>

        <View style={styles.tagline}>
          <Text style={styles.taglineText}>The classic card game</Text>
          <Text style={styles.taglineText}>with a competitive twist</Text>
        </View>

        <View style={styles.buttonContainer}>
          {isAppleAvailable && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE_OUTLINE}
              cornerRadius={radius.button}
              style={styles.appleButton}
              onPress={signIn}
            />
          )}
          {!isAppleAvailable && (
            <TouchableOpacity style={styles.fallbackButton} onPress={signIn} disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.fallbackButtonText}>Sign In to Play</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.highlightsRow}>
          <View style={styles.highlightPill}><Text style={styles.highlightText}>Solo bots</Text></View>
          <View style={styles.highlightPill}><Text style={styles.highlightText}>Live rooms</Text></View>
          <View style={styles.highlightPill}><Text style={styles.highlightText}>Friends</Text></View>
        </View>

        <Text style={styles.disclaimer}>
          By continuing, you agree to our Terms of Service
        </Text>
      </View>
    </Background>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  logoContainer: {
    marginBottom: spacing.huge,
  },
  tagline: {
    alignItems: 'center',
    marginBottom: spacing.huge,
  },
  taglineText: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium as any,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 340,
    marginBottom: spacing.lg,
  },
  appleButton: {
    width: '100%',
    height: 54,
  },
  highlightsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  highlightPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  highlightText: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium as any,
  },
  fallbackButton: {
    backgroundColor: colors.primary,
    height: 54,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  fallbackButtonText: {
    color: '#fff',
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold as any,
  },
  disclaimer: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 18,
  },
});