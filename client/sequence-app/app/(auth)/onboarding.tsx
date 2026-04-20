import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { Background } from '@/components/ui/Background';
import { Button } from '@/components/ui/Button';
import { AvatarPicker } from '@/components/ui/Avatar';
import { HeaderBar } from '@/components/ui/HeaderBar';
import { Toast } from '@/components/ui/Toast';
import { colors, spacing, fontSize, fontWeight, radius, AVATAR_EMOJIS, AVATAR_COLORS } from '@/theme';

export default function OnboardingScreen() {
  const { completeRegistration, isLoading, errorMessage, clearError, suggestedName, checkUsername, usernameAvailability, needsUsername, tempToken, sessionToken, user } = useAuthStore();
  const [step, setStep] = useState<'username' | 'avatar'>('username');
  const [username, setUsername] = useState(suggestedName ?? '');
  const [displayName, setDisplayName] = useState(suggestedName ?? '');
  const [selectedAvatar, setSelectedAvatar] = useState<string>(AVATAR_EMOJIS[0]);
  const [selectedColor, setSelectedAvatarColor] = useState<string>(AVATAR_COLORS[0]);

  React.useEffect(() => {
    if (suggestedName) {
      setUsername((current) => current || suggestedName);
      setDisplayName((current) => current || suggestedName);
    }
  }, [suggestedName]);

  if (sessionToken && user) {
    return <Redirect href="/(main)/home" />;
  }

  if (!needsUsername || !tempToken) {
    return <Redirect href="/(auth)/login" />;
  }

  const checkUsernameDebounced = useCallback(
    debounce(async (name: string) => {
      if (name.length < 3) return;
      await checkUsername(name);
    }, 500),
    [checkUsername],
  );

  const handleUsernameChange = (text: string) => {
    const cleaned = text.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
    setUsername(cleaned);
    checkUsernameDebounced(cleaned);
  };

  const handleContinue = () => {
    if (!usernameAvailability.available || username.length < 3) return;
    if (!displayName.trim()) setDisplayName(username);
    setStep('avatar');
  };

  const handleSubmit = async () => {
    try {
      await completeRegistration(username, displayName || username, selectedAvatar, selectedColor);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <Background style={styles.container}>
      <Toast message={errorMessage} type="error" onDismiss={clearError} />
      {step === 'username' ? (
        <View style={styles.stepContainer}>
          <Text style={styles.stepTitle}>Choose your username</Text>
          <Text style={styles.stepSubtitle}>This is how other players will find you</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Username</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={handleUsernameChange}
                placeholder="coolplayer42"
                placeholderTextColor={colors.textDisabled}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={20}
              />
              {usernameAvailability.checking && <Text style={styles.checkingText}>...</Text>}
              {!usernameAvailability.checking && usernameAvailability.available === true && <Text style={styles.availableText}>✓</Text>}
              {!usernameAvailability.checking && usernameAvailability.available === false && username.length >= 3 && <Text style={styles.takenText}>✗</Text>}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Display Name (optional)</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder={username}
              placeholderTextColor={colors.textDisabled}
              autoCorrect={false}
              maxLength={30}
            />
          </View>

          <Button
            title="Continue"
            onPress={handleContinue}
            disabled={!usernameAvailability.available || username.length < 3}
            loading={isLoading}
          />
        </View>
      ) : (
        <View style={styles.stepContainer}>
          <HeaderBar title="Choose your avatar" />
          <ScrollView contentContainerStyle={styles.avatarScroll}>
            <View style={styles.avatarPreview}>
              <View style={[styles.previewCircle, { backgroundColor: selectedColor }]}>
                <Text style={styles.previewEmoji}>{selectedAvatar}</Text>
              </View>
              <Text style={styles.previewName}>{displayName || username}</Text>
            </View>
            <AvatarPicker
              selectedAvatar={selectedAvatar}
              selectedColor={selectedColor}
              onAvatarChange={setSelectedAvatar}
              onColorChange={setSelectedAvatarColor}
            />
            <View style={styles.spacer} />
            <Button
              title="Start Playing"
              onPress={handleSubmit}
              loading={isLoading}
            />
          </ScrollView>
        </View>
      )}
    </Background>
  );
}

function debounce(fn: (...args: any[]) => void, ms: number): (...args: any[]) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  stepContainer: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.huge,
  },
  stepTitle: {
    color: colors.text,
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold as any,
    marginBottom: spacing.sm,
  },
  stepSubtitle: {
    color: colors.textSecondary,
    fontSize: fontSize.base,
    marginBottom: spacing.xl,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium as any,
    marginBottom: spacing.sm,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: colors.cardBg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: fontSize.base,
  },
  checkingText: {
    color: colors.textTertiary,
    marginLeft: spacing.sm,
  },
  availableText: {
    color: colors.success,
    fontSize: 18,
    marginLeft: spacing.sm,
  },
  takenText: {
    color: colors.error,
    fontSize: 18,
    marginLeft: spacing.sm,
  },
  avatarScroll: {
    paddingBottom: spacing.huge,
  },
  avatarPreview: {
    alignItems: 'center',
    marginVertical: spacing.xl,
  },
  previewCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  previewEmoji: {
    fontSize: 36,
  },
  previewName: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold as any,
  },
  spacer: {
    height: spacing.xl,
  },
});