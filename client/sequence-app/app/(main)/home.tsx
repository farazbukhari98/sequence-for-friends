import React from 'react';
import { Image, View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';
import { useGameStore } from '@/stores/gameStore';
import { api } from '@/services/api';
import { Background, Logo } from '@/components/ui/Background';
import { AvatarBubble } from '@/components/ui/Avatar';
import { SurfaceTexture } from '@/components/ui/GameTexture';
import { gameImages } from '@/constants/gameAssets';
import { hapticSelection } from '@/lib/haptics';
import { colors, spacing, fontSize, fontWeight, radius, shadows } from '@/theme';
import { emptyStats, type UserStats } from '@/types/game';

type HomeAction = {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  route: '/(main)/solo-practice' | '/(main)/create-room' | '/(main)/join-room' | '/(main)/friends';
};

const HOME_ACTIONS: HomeAction[] = [
  {
    title: 'Solo Table',
    subtitle: 'Practice against a bot dealer',
    icon: 'hardware-chip-outline',
    accent: colors.success,
    route: '/(main)/solo-practice',
  },
  {
    title: 'Host Game',
    subtitle: 'Build the table and rules',
    icon: 'add-circle-outline',
    accent: colors.gold,
    route: '/(main)/create-room',
  },
  {
    title: 'Join Room',
    subtitle: 'Use a 5-character table code',
    icon: 'enter-outline',
    accent: colors.cyan,
    route: '/(main)/join-room',
  },
  {
    title: 'Friends',
    subtitle: 'Invite players to the table',
    icon: 'people-outline',
    accent: colors.teamBlue,
    route: '/(main)/friends',
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, sessionToken } = useAuthStore();
  const { pendingRoomCode } = useGameStore();
  const [stats, setStats] = React.useState<UserStats>(emptyStats);

  React.useEffect(() => {
    if (pendingRoomCode) {
      Alert.alert('Game Invite', `You've been invited to room ${pendingRoomCode}. Join?`, [
        { text: 'Decline', style: 'cancel', onPress: () => useGameStore.getState().setPendingRoomCode(null) },
        {
          text: 'Join',
          onPress: () => {
            useGameStore.getState().setPendingRoomCode(null);
            router.push('/(main)/join-room');
          },
        },
      ]);
    }
  }, [pendingRoomCode, router]);

  React.useEffect(() => {
    let active = true;
    if (!sessionToken) return;

    api.getMyStats(sessionToken)
      .then((response) => {
        if (active) setStats(response.stats);
      })
      .catch(() => {
        if (active) setStats(emptyStats);
      });

    return () => {
      active = false;
    };
  }, [sessionToken]);

  const displayName = user?.displayName || user?.username || 'Player';

  return (
    <Background style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: Math.max(spacing.xxl, insets.top + spacing.md), paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Logo size="small" />
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={() => { hapticSelection(); router.push('/(main)/friends'); }} style={styles.headerChip}>
              <Ionicons name="people-outline" size={20} color={colors.textDark} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { hapticSelection(); router.push('/(main)/profile'); }} style={styles.profileButton}>
              {user && <AvatarBubble avatarId={user.avatarId} avatarColor={user.avatarColor} size={36} />}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.heroTable}>
          <SurfaceTexture variant="wood" intensity="medium" style={styles.panelTexture} />
          <View style={styles.heroTopLine}>
            <View style={styles.heroTextBlock}>
              <Text style={styles.eyebrow}>Classic Game Night</Text>
              <Text style={styles.heroTitle}>Your Table Is Ready</Text>
              <Text style={styles.heroCopy}>Welcome back, {displayName}. Choose a seat, deal in, and start building sequences.</Text>
            </View>
            <View style={styles.heroArtFrame}>
              <Image source={gameImages.cardsChipsVignette} style={styles.heroArtImage} resizeMode="contain" />
              <View pointerEvents="none" style={styles.heroArtRing} />
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Choose Your Seat</Text>
          <Text style={styles.sectionMeta}>Fast play</Text>
        </View>

        <View style={styles.actionGrid}>
          {HOME_ACTIONS.map((action) => (
            <TouchableOpacity
              key={action.title}
              style={[styles.actionTile, { borderColor: action.accent }]}
              onPress={() => {
                hapticSelection();
                router.push(action.route);
              }}
              activeOpacity={0.86}
            >
              <SurfaceTexture variant="card" intensity="subtle" style={styles.tileTexture} />
              <View style={[styles.actionIcon, { backgroundColor: action.accent }]}>
                <Ionicons name={action.icon} size={24} color="#fff" />
              </View>
              <Text style={styles.actionTitle}>{action.title}</Text>
              <Text style={styles.actionSubtitle}>{action.subtitle}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {user && (
          <View style={styles.statsPanel}>
            <SurfaceTexture variant="card" intensity="subtle" style={styles.panelTexture} />
            <View style={styles.statsHeader}>
              <Text style={styles.statsTitle}>Scoreboard</Text>
              <TouchableOpacity onPress={() => { hapticSelection(); router.push('/(main)/detailed-stats'); }}>
                <Text style={styles.statsLink}>Details</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.statsRow}>
              <StatChip value={String(stats.gamesPlayed)} label="Games" />
              <StatChip value={`${Math.round(stats.winRate * 100)}%`} label="Win Rate" />
              <StatChip value={String(stats.gamesWon)} label="Wins" />
            </View>
          </View>
        )}
      </ScrollView>
    </Background>
  );
}

function StatChip({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statChip}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.lg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
    ...shadows.sm,
  },
  profileButton: {
    borderWidth: 2,
    borderColor: colors.gold,
    borderRadius: 22,
  },
  heroTable: {
    backgroundColor: colors.primaryDark,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: '#4A2511',
    padding: spacing.lg,
    marginBottom: spacing.xl,
    position: 'relative',
    overflow: 'hidden',
    ...shadows.lg,
  },
  heroTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  heroTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    color: colors.gold,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold as any,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: colors.textOnDark,
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold as any,
    marginTop: spacing.xs,
  },
  heroArtFrame: {
    width: 118,
    height: 118,
    borderRadius: 59,
    backgroundColor: 'rgba(13,59,34,0.8)',
    borderWidth: 2,
    borderColor: 'rgba(212,175,55,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    ...shadows.md,
  },
  heroArtImage: {
    width: 112,
    height: 112,
  },
  heroArtRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 59,
    borderWidth: 8,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  heroCopy: {
    color: colors.textOnDarkSecondary,
    fontSize: fontSize.base,
    lineHeight: 21,
    marginTop: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    color: colors.textOnDark,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold as any,
  },
  sectionMeta: {
    color: colors.textOnDarkTertiary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold as any,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  actionTile: {
    width: '47.8%',
    minHeight: 148,
    backgroundColor: colors.cardBg,
    borderRadius: radius.md,
    borderWidth: 2,
    padding: spacing.md,
    justifyContent: 'space-between',
    position: 'relative',
    ...shadows.md,
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.72)',
  },
  actionTitle: {
    color: colors.textDark,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold as any,
    marginTop: spacing.md,
  },
  actionSubtitle: {
    color: colors.textDarkTertiary,
    fontSize: fontSize.sm,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  statsPanel: {
    backgroundColor: '#E8DCC4',
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.primary,
    padding: spacing.md,
    marginBottom: spacing.xl,
    position: 'relative',
    ...shadows.md,
  },
  panelTexture: {
    opacity: 0.24,
  },
  tileTexture: {
    opacity: 0.26,
  },
  statsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  statsTitle: {
    color: colors.textDark,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold as any,
  },
  statsLink: {
    color: colors.primaryDark,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold as any,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statChip: {
    flex: 1,
    minHeight: 74,
    borderRadius: radius.md,
    backgroundColor: colors.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  statValue: {
    color: colors.textDark,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold as any,
  },
  statLabel: {
    color: colors.textDarkTertiary,
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
});
