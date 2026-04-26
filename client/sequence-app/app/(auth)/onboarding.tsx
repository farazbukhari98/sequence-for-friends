import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';
import { Background } from '@/components/ui/Background';
import { Button } from '@/components/ui/Button';
import { AvatarPicker, AvatarBubble } from '@/components/ui/Avatar';
import { HeaderBar } from '@/components/ui/HeaderBar';
import { Toast } from '@/components/ui/Toast';
import { colors, spacing, fontSize, fontWeight, radius, AVATAR_SYMBOLS, AVATAR_COLORS } from '@/theme';

export default function OnboardingScreen() {
  const { completeRegistration, isLoading, errorMessage, clearError, suggestedName, checkUsername, usernameAvailability } = useAuthStore();
  const [step, setStep] = useState<'username' | 'avatar'>('username');
  const [username, setUsername] = useState(suggestedName ?? '');
  const [displayName, setDisplayName] = useState(suggestedName ?? '');
  const [selectedAvatar, setSelectedAvatar] = useState<string>(AVATAR_SYMBOLS[0]);
  const [selectedColor, setSelectedAvatarColor] = useState<string>(AVATAR_COLORS[0]);

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
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {step === 'username' ? (
          <ScrollView
            contentContainerStyle={styles.usernameScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
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
                {!usernameAvailability.checking && usernameAvailability.available === true && (
                  <Ionicons name="checkmark-circle" size={20} color={colors.success} style={styles.availableIcon} />
                )}
                {!usernameAvailability.checking && usernameAvailability.available === false && username.length >= 3 && (
                  <Ionicons name="close-circle" size={20} color={colors.error} style={styles.takenIcon} />
                )}
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
          </ScrollView>
        ) : (
          <View style={styles.stepContainer}>
            <HeaderBar title="Choose your avatar" />
            <ScrollView
              contentContainerStyle={styles.avatarScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.avatarPreview}>
                <AvatarBubble
                  avatarId={selectedAvatar}
                  avatarColor={selectedColor}
                  size={80}
                  showBorder
                />
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
      </KeyboardAvoidingView>
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
  keyboardView: {
    flex: 1,
  },
  usernameScroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.huge,
    paddingBottom: spacing.huge,
  },
  stepContainer: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.huge,
  },
  stepTitle: {
    color: colors.textOnDark,
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold as any,
    marginBottom: spacing.sm,
  },
  stepSubtitle: {
    color: colors.textOnDarkSecondary,
    fontSize: fontSize.base,
    marginBottom: spacing.xl,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    color: colors.textOnDarkSecondary,
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
    color: colors.textOnDarkTertiary,
    marginLeft: spacing.sm,
  },
  availableIcon: {
    marginLeft: spacing.sm,
  },
  takenIcon: {
    marginLeft: spacing.sm,
  },
  avatarScroll: {
    paddingBottom: spacing.huge,
  },
  avatarPreview: {
    alignItems: 'center',
    marginVertical: spacing.xl,
  },
  previewName: {
    marginTop: spacing.md,
    color: colors.textOnDark,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold as any,
  },
  spacer: {
    height: spacing.xl,
  },
});
