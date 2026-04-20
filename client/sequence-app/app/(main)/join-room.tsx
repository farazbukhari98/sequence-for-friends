import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useGameStore } from '@/stores/gameStore';
import { Background } from '@/components/ui/Background';
import { HeaderBar } from '@/components/ui/HeaderBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { colors, spacing, fontSize, fontWeight, radius } from '@/theme';

export default function JoinRoomScreen() {
  const router = useRouter();
  const { user, sessionToken } = useAuthStore();
  const { joinRoom, pendingRoomCode, setPendingRoomCode } = useGameStore();
  const [code, setCode] = useState(pendingRoomCode ?? '');
  const [isJoining, setIsJoining] = useState(false);

  React.useEffect(() => {
    if (pendingRoomCode) {
      setCode(pendingRoomCode);
    }
  }, [pendingRoomCode]);

  const handleJoin = async () => {
    if (!sessionToken || !user) return;
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) {
      Alert.alert('Invalid Code', 'Please enter a valid room code');
      return;
    }
    setIsJoining(true);
    try {
      await joinRoom(trimmed, user.displayName || user.username, sessionToken);
      setPendingRoomCode(null);
      router.push('/(game)/lobby');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <Background style={styles.container}>
      <HeaderBar title="Join Game" onBack={() => router.back()} />
      <View style={styles.content}>
        <Card style={styles.card}>
          <Text style={styles.title}>Enter Room Code</Text>
          <Text style={styles.subtitle}>
            {pendingRoomCode ? `Invite detected for room ${pendingRoomCode}` : 'Ask the room host for the 4-letter code'}
          </Text>
          <TextInput
            style={styles.codeInput}
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            placeholder="ABCD"
            placeholderTextColor={colors.textDisabled}
            autoCapitalize="characters"
            maxLength={6}
            textAlign="center"
            autoFocus
          />
          <Button
            title="Join Room"
            onPress={handleJoin}
            loading={isJoining}
            disabled={code.trim().length < 4}
          />
        </Card>
      </View>
    </Background>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl },
  card: { padding: spacing.xl },
  title: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold as any,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: fontSize.base,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  codeInput: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    color: colors.text,
    fontSize: fontSize.huge,
    fontWeight: fontWeight.bold as any,
    letterSpacing: 8,
    borderWidth: 2,
    borderColor: colors.cardBorder,
    marginBottom: spacing.xl,
  },
});