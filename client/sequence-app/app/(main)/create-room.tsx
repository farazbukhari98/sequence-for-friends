import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useGameStore } from '@/stores/gameStore';
import { Background } from '@/components/ui/Background';
import { HeaderBar } from '@/components/ui/HeaderBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SegmentPicker, Stepper } from '@/components/ui/SegmentPicker';
import { colors, spacing, fontSize, fontWeight } from '@/theme';
import type { GameVariant } from '@/types/game';

export default function CreateRoomScreen() {
  const router = useRouter();
  const { user, sessionToken } = useAuthStore();
  const { createRoom } = useGameStore();

  const [roomName, setRoomName] = useState(`${user?.displayName || user?.username || 'Player'}'s Room`);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [teamCount, setTeamCount] = useState<2 | 3>(2);
  const [turnTimeLimit, setTurnTimeLimit] = useState(30);
  const [sequencesToWin, setSequencesToWin] = useState(2);

  const handleCreate = async () => {
    if (!sessionToken || !user) return;
    try {
      await createRoom({
        roomName,
        playerName: user.displayName || user.username,
        maxPlayers,
        teamCount,
        turnTimeLimit,
        sequencesToWin,
      }, sessionToken);
      router.push('/(game)/lobby');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <Background style={styles.container}>
      <HeaderBar title="Create Game" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Room Name</Text>
          <TextInput
            style={styles.input}
            value={roomName}
            onChangeText={setRoomName}
            placeholder="Room name"
            placeholderTextColor={colors.textDisabled}
            maxLength={30}
          />
        </Card>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Game Mode</Text>
          <SegmentPicker
            options={[
              { label: 'Classic', value: 'classic' as GameVariant },
            ]}
            selected="classic"
            onSelect={() => {}}
          />
        </Card>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <View style={styles.settingsGrid}>
            <Stepper label="Max Players" value={maxPlayers} min={2} max={6} onChange={setMaxPlayers} />
            <SegmentPicker
              options={[
                { label: '2 Teams', value: '2' },
                { label: '3 Teams', value: '3' },
              ]}
              selected={String(teamCount)}
              onSelect={(v) => setTeamCount(Number(v) as 2 | 3)}
            />
            <Stepper label="Turn Timer (s)" value={turnTimeLimit} min={10} max={120} step={10} onChange={setTurnTimeLimit} />
            <Stepper label="Sequences to Win" value={sequencesToWin} min={1} max={5} onChange={setSequencesToWin} />
          </View>
        </Card>

        <Button title="Create Room" onPress={handleCreate} style={styles.createButton} />
      </ScrollView>
    </Background>
  );
}

import { TextInput } from 'react-native';

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.huge },
  section: { padding: spacing.lg, marginBottom: spacing.md },
  sectionTitle: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold as any,
    marginBottom: spacing.md,
  },
  input: {
    backgroundColor: colors.bgElevated,
    borderRadius: 12,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: fontSize.base,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  settingsGrid: {
    gap: spacing.lg,
  },
  createButton: {
    marginTop: spacing.lg,
  },
});