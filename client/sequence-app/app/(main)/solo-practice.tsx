import React, { useState } from 'react';
import { Image, View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';
import { useGameStore } from '@/stores/gameStore';
import { Background } from '@/components/ui/Background';
import { HeaderBar } from '@/components/ui/HeaderBar';
import { Button } from '@/components/ui/Button';
import { SegmentPicker } from '@/components/ui/SegmentPicker';
import { SurfaceTexture } from '@/components/ui/GameTexture';
import { gameImages } from '@/constants/gameAssets';
import { hapticSelection } from '@/lib/haptics';
import { colors, spacing, fontSize, fontWeight, radius, shadows } from '@/theme';
import { DIFFICULTY_INFO as DIFF } from '@/constants/board';
import {
  SERIES_LENGTH_OPTIONS,
  SEQUENCE_LENGTH_OPTIONS,
  type BotDifficulty,
  type SequenceLength,
  type SequencesToWin,
  type SeriesLength,
} from '@/types/game';

const DIFFICULTY_COPY: Record<BotDifficulty, string> = {
  easy: 'A relaxed bot that leaves room to learn.',
  medium: 'A balanced opponent for a normal table.',
  hard: 'Sharper card play and fewer mistakes.',
  impossible: 'The trophy table. Bring your best hand.',
};

export default function SoloPracticeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, sessionToken } = useAuthStore();
  const { createBotGame } = useGameStore();

  const [difficulty, setDifficulty] = useState<BotDifficulty>('medium');
  const [sequencesToWin, setSequencesToWin] = useState<SequencesToWin>(2);
  const [sequenceLength, setSequenceLength] = useState<SequenceLength>(5);
  const [seriesLength, setSeriesLength] = useState<SeriesLength>(0);

  const handleStart = async () => {
    if (!sessionToken || !user) return;
    try {
      await createBotGame({
        playerName: user.displayName || user.username,
        difficulty,
        sequenceLength,
        sequencesToWin,
        seriesLength,
      }, sessionToken);
      router.replace('/(game)/lobby');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const difficulties: BotDifficulty[] = ['easy', 'medium', 'hard', 'impossible'];
  const selectedInfo = DIFF[difficulty];

  return (
    <Background style={styles.container}>
      <HeaderBar title="Solo Table" onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.huge }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.dealerPanel}>
          <SurfaceTexture variant="wood" intensity="medium" style={styles.panelTexture} />
          <View style={styles.botPortrait}>
            <Image source={gameImages.botDealerToken} style={styles.botPortraitImage} resizeMode="contain" />
            <View style={[styles.botDifficultyBadge, { backgroundColor: selectedInfo.color }]}>
              <Ionicons name={selectedInfo.icon as any} size={15} color="#fff" />
            </View>
          </View>
          <View style={styles.dealerCopy}>
            <Text style={styles.eyebrow}>Bot Dealer</Text>
            <Text style={styles.dealerTitle}>{selectedInfo.label} Table</Text>
            <Text style={styles.dealerText}>{DIFFICULTY_COPY[difficulty]}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Choose Opponent</Text>
        <View style={styles.difficultyGrid}>
          {difficulties.map((d) => {
            const info = DIFF[d];
            const selected = difficulty === d;
            return (
              <TouchableOpacity
                key={d}
                onPress={() => {
                  hapticSelection();
                  setDifficulty(d);
                }}
                activeOpacity={0.86}
                style={[styles.diffCard, selected && { borderColor: info.color, backgroundColor: colors.cardBgHover }]}
              >
                <SurfaceTexture variant="card" intensity="subtle" style={styles.cardTexture} />
                <View style={[styles.diffChip, { backgroundColor: info.color }]}>
                  <Ionicons name={info.icon as any} size={20} color="#fff" />
                </View>
                <Text style={styles.diffLabel}>{info.label}</Text>
                <Text style={styles.diffDescription}>{DIFFICULTY_COPY[d]}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.settingsPanel}>
          <SurfaceTexture variant="card" intensity="subtle" style={styles.cardTexture} />
          <Text style={styles.settingsTitle}>Match Length</Text>
          <Text style={styles.settingsCopy}>Set how many sequences decide the table.</Text>
          <SegmentPicker
            options={[
              { label: '1', value: '1' },
              { label: '2', value: '2' },
              { label: '3', value: '3' },
            ]}
            selected={String(sequencesToWin)}
            onSelect={(v) => setSequencesToWin(Number(v) as SequencesToWin)}
          />

          <Text style={styles.settingsTitle}>Sequence Format</Text>
          <SegmentPicker
            options={SEQUENCE_LENGTH_OPTIONS.map(option => ({
              label: option.label,
              value: String(option.value),
            }))}
            selected={String(sequenceLength)}
            onSelect={(v) => {
              hapticSelection();
              setSequenceLength(Number(v) as SequenceLength);
            }}
          />

          <Text style={styles.settingsTitle}>Series</Text>
          <SegmentPicker
            options={SERIES_LENGTH_OPTIONS.map(option => ({
              label: option.shortLabel,
              value: String(option.value),
            }))}
            selected={String(seriesLength)}
            onSelect={(v) => {
              hapticSelection();
              setSeriesLength(Number(v) as SeriesLength);
            }}
          />
        </View>

        <Button
          title="Deal Solo Game"
          onPress={handleStart}
          style={styles.startButton}
          icon={<Ionicons name="play" size={18} color="#fff" />}
        />
      </ScrollView>
    </Background>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: spacing.lg },
  dealerPanel: {
    backgroundColor: colors.primaryDark,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: '#4A2511',
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
    position: 'relative',
    ...shadows.lg,
  },
  botPortrait: {
    width: 94,
    height: 94,
    borderRadius: 47,
    backgroundColor: colors.background,
    borderWidth: 4,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  botPortraitImage: {
    width: 88,
    height: 88,
  },
  botDifficultyBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: colors.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dealerCopy: { flex: 1 },
  eyebrow: {
    color: colors.gold,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold as any,
    textTransform: 'uppercase',
  },
  dealerTitle: {
    color: colors.textOnDark,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold as any,
    marginTop: spacing.xs,
  },
  dealerText: {
    color: colors.textOnDarkSecondary,
    fontSize: fontSize.sm,
    lineHeight: 18,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    color: colors.textOnDark,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold as any,
    marginBottom: spacing.md,
  },
  difficultyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  diffCard: {
    width: '47.8%',
    minHeight: 156,
    backgroundColor: colors.cardBg,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    position: 'relative',
    ...shadows.md,
  },
  diffChip: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  diffLabel: {
    color: colors.textDark,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold as any,
    marginTop: spacing.md,
  },
  diffDescription: {
    color: colors.textDarkTertiary,
    fontSize: fontSize.xs,
    lineHeight: 16,
    marginTop: spacing.xs,
  },
  settingsPanel: {
    backgroundColor: '#E8DCC4',
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.primary,
    padding: spacing.lg,
    gap: spacing.md,
    position: 'relative',
    ...shadows.md,
  },
  panelTexture: {
    opacity: 0.24,
  },
  cardTexture: {
    opacity: 0.28,
  },
  settingsTitle: {
    color: colors.textDark,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold as any,
  },
  settingsCopy: {
    color: colors.textDarkTertiary,
    fontSize: fontSize.sm,
    lineHeight: 18,
  },
  startButton: {
    marginTop: spacing.xl,
  },
});
