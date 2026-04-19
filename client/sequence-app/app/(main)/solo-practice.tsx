import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useGameStore } from '@/stores/gameStore';
import { Background } from '@/components/ui/Background';
import { HeaderBar } from '@/components/ui/HeaderBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SegmentPicker } from '@/components/ui/SegmentPicker';
import { colors, spacing, fontSize, fontWeight, radius } from '@/theme';
import { DIFFICULTY_INFO as DIFF } from '@/constants/board';
import type { BotDifficulty } from '@/types/game';

export default function SoloPracticeScreen() {
  const router = useRouter();
  const { user, sessionToken } = useAuthStore();
  const { createBotGame } = useGameStore();

  const [difficulty, setDifficulty] = useState<BotDifficulty>('medium');
  const [sequencesToWin, setSequencesToWin] = useState(2);

  const handleStart = async () => {
    if (!sessionToken || !user) return;
    try {
      await createBotGame({
        playerName: user.displayName || user.username,
        difficulty,
        sequenceLength: 5,
        sequencesToWin,
        seriesLength: 1,
      }, sessionToken);
      router.push('/(game)/lobby');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const difficulties: BotDifficulty[] = ['easy', 'medium', 'hard', 'impossible'];

  return (
    <Background style={styles.container}>
      <HeaderBar title="Solo Practice" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Difficulty</Text>
        <View style={styles.difficultyGrid}>
          {difficulties.map((d) => {
            const info = DIFF[d];
            return (
              <Card
                key={d}
                onPress={() => setDifficulty(d)}
                style={[styles.diffCard, difficulty === d ? { borderColor: info.color } : {}] as any}
              >
                <Text style={styles.diffEmoji}>{info.emoji}</Text>
                <Text style={[styles.diffLabel, { color: difficulty === d ? info.color : colors.text }]}>
                  {info.label}
                </Text>
              </Card>
            );
          })}
        </View>

        <Card style={styles.settingsCard}>
          <Text style={styles.sectionTitle}>Sequences to Win</Text>
          <SegmentPicker
            options={[
              { label: '1', value: '1' },
              { label: '2', value: '2' },
              { label: '3', value: '3' },
            ]}
            selected={String(sequencesToWin)}
            onSelect={(v) => setSequencesToWin(Number(v))}
          />
        </Card>

        <Button
          title="Start Practice Game"
          onPress={handleStart}
          style={styles.startButton}
        />
      </ScrollView>
    </Background>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.huge },
  sectionTitle: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold as any,
    marginBottom: spacing.md,
    marginTop: spacing.lg,
  },
  difficultyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  diffCard: {
    width: '47%',
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.cardBorder,
  },
  diffEmoji: {
    fontSize: 32,
    marginBottom: spacing.sm,
  },
  diffLabel: {
    color: colors.text,
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold as any,
  },
  settingsCard: {
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  startButton: {
    marginTop: spacing.xl,
  },
});