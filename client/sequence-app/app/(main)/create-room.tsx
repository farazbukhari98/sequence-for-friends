import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';
import { useGameStore } from '@/stores/gameStore';
import { Background } from '@/components/ui/Background';
import { HeaderBar } from '@/components/ui/HeaderBar';
import { Button } from '@/components/ui/Button';
import { SegmentPicker, Stepper } from '@/components/ui/SegmentPicker';
import { SurfaceTexture } from '@/components/ui/GameTexture';
import { gameImages } from '@/constants/gameAssets';
import { hapticSelection } from '@/lib/haptics';
import { colors, spacing, fontSize, fontWeight, radius, shadows } from '@/theme';
import {
  SERIES_LENGTH_OPTIONS,
  SEQUENCE_LENGTH_OPTIONS,
  TURN_TIME_OPTIONS,
  type SequenceLength,
  type SeriesLength,
  type TurnTimeLimit,
} from '@/types/game';

export default function CreateRoomScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, sessionToken } = useAuthStore();
  const { createRoom } = useGameStore();

  const [roomName, setRoomName] = useState(`${user?.displayName || user?.username || 'Player'}'s Table`);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [teamCount, setTeamCount] = useState<2 | 3>(2);
  const [turnTimeLimit, setTurnTimeLimit] = useState<TurnTimeLimit>(30);
  const [sequencesToWin, setSequencesToWin] = useState(2);
  const [sequenceLength, setSequenceLength] = useState<SequenceLength>(5);
  const [seriesLength, setSeriesLength] = useState<SeriesLength>(0);

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
        sequenceLength,
        seriesLength,
      }, sessionToken);
      router.push('/(game)/lobby');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <Background style={styles.container}>
      <HeaderBar title="Host Game" onBack={() => router.back()} />
      <KeyboardAvoidingView style={styles.keyboardAvoider} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.huge }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.hostPanel}>
            <SurfaceTexture variant="wood" intensity="medium" style={styles.panelTexture} />
            <View style={styles.panelHeader}>
              <View>
                <Text style={styles.eyebrow}>Dealer Setup</Text>
                <Text style={styles.panelTitle}>Build the table</Text>
              </View>
              <View style={styles.panelIcon}>
                <Ionicons name="albums-outline" size={24} color={colors.gold} />
              </View>
            </View>

            <Text style={styles.inputLabel}>Table Name</Text>
            <TextInput
              style={styles.input}
              value={roomName}
              onChangeText={setRoomName}
              placeholder="Room name"
              placeholderTextColor={colors.textDisabled}
              maxLength={30}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Game Type</Text>
            <View style={styles.modeCard}>
              <SurfaceTexture variant="card" intensity="subtle" style={styles.cardTexture} />
              <View style={styles.modeBoard}>
                <Image source={gameImages.cardsChipsVignette} style={styles.modeBoardImage} resizeMode="contain" />
              </View>
              <View style={styles.modeContent}>
                <Text style={styles.modeTitle}>{sequenceLength === 4 ? 'Blitz Sequence' : 'Classic Sequence'}</Text>
                <Text style={styles.modeSubtitle}>
                  {sequenceLength === 4 ? 'Fast 4-chip sequences for shorter rounds.' : 'Standard 5-chip sequences with full table tension.'}
                </Text>
              </View>
              <View style={styles.selectedBadge}>
                <Ionicons name="checkmark" size={16} color="#fff" />
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Table Rules</Text>
            <View style={styles.rulesSurface}>
              <SurfaceTexture variant="card" intensity="subtle" style={styles.cardTexture} />
              <View style={styles.stepperRow}>
                <Stepper label="Max Players" value={maxPlayers} min={2} max={6} onChange={setMaxPlayers} />
                <Stepper label="Sequences" value={sequencesToWin} min={1} max={4} onChange={setSequencesToWin} />
              </View>

              <View style={styles.settingBlock}>
                <Text style={styles.settingLabel}>Teams</Text>
                <SegmentPicker
                  options={[
                    { label: '2 Teams', value: '2' },
                    { label: '3 Teams', value: '3' },
                  ]}
                  selected={String(teamCount)}
                  onSelect={(v) => setTeamCount(Number(v) as 2 | 3)}
                />
              </View>

              <View style={styles.settingBlock}>
                <Text style={styles.settingLabel}>Sequence Format</Text>
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
              </View>

              <View style={styles.settingBlock}>
                <Text style={styles.settingLabel}>Series</Text>
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

              <View style={styles.settingBlock}>
                <Text style={styles.settingLabel}>Turn Timer</Text>
                <View style={styles.timerOptions}>
                  {TURN_TIME_OPTIONS.map((option) => {
                    const selected = option.value === turnTimeLimit;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        testID={`turn-timer-${option.value}`}
                        style={[styles.timerChip, selected && styles.timerChipSelected]}
                        onPress={() => {
                          hapticSelection();
                          setTurnTimeLimit(option.value);
                        }}
                        activeOpacity={0.78}
                      >
                        <Text style={[styles.timerChipText, selected && styles.timerChipTextSelected]}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          </View>

          <Button
            title="Create Room"
            onPress={handleCreate}
            style={styles.createButton}
            icon={<Ionicons name="play" size={18} color="#fff" />}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Background>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardAvoider: { flex: 1 },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.huge },
  hostPanel: {
    backgroundColor: colors.primaryDark,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: '#4A2511',
    padding: spacing.lg,
    marginBottom: spacing.xl,
    position: 'relative',
    ...shadows.lg,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  eyebrow: {
    color: colors.gold,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold as any,
    textTransform: 'uppercase',
  },
  panelTitle: {
    color: colors.textOnDark,
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold as any,
    marginTop: spacing.xs,
  },
  panelIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(248,241,228,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputLabel: {
    color: colors.textOnDarkSecondary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold as any,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    color: colors.textDark,
    fontSize: fontSize.base,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    color: colors.textOnDark,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold as any,
    marginBottom: spacing.md,
  },
  modeCard: {
    minHeight: 132,
    backgroundColor: colors.cardBg,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.gold,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    position: 'relative',
    ...shadows.md,
  },
  modeBoard: {
    width: 78,
    height: 78,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.primaryDark,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeBoardImage: {
    width: 74,
    height: 74,
  },
  modeContent: {
    flex: 1,
  },
  modeTitle: {
    color: colors.textDark,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold as any,
  },
  modeSubtitle: {
    color: colors.textDarkTertiary,
    fontSize: fontSize.sm,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  selectedBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rulesSurface: {
    backgroundColor: '#E8DCC4',
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.primary,
    padding: spacing.md,
    gap: spacing.lg,
    position: 'relative',
    ...shadows.md,
  },
  panelTexture: {
    opacity: 0.24,
  },
  cardTexture: {
    opacity: 0.28,
  },
  stepperRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: spacing.md,
  },
  settingBlock: {
    gap: spacing.sm,
  },
  settingLabel: {
    color: colors.textDarkSecondary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold as any,
    textAlign: 'center',
  },
  timerOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  timerChip: {
    minWidth: 64,
    minHeight: 40,
    borderRadius: 20,
    backgroundColor: colors.cardBg,
    borderWidth: 2,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  timerChipSelected: {
    backgroundColor: colors.teamBlue,
    borderColor: '#fff',
  },
  timerChipText: {
    color: colors.textDark,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold as any,
  },
  timerChipTextSelected: {
    color: '#fff',
  },
  createButton: {
    marginTop: spacing.sm,
  },
});
