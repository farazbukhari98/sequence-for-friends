import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useGameStore } from '@/stores/gameStore';
import { Background } from '@/components/ui/Background';
import { Logo } from '@/components/ui/Background';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { AvatarBubble } from '@/components/ui/Avatar';
import { colors, spacing, fontSize, fontWeight, radius } from '@/theme';

export default function HomeScreen() {
  const router = useRouter();
  const { user, signOut } = useAuthStore();
  const { pendingRoomCode } = useGameStore();

  // Handle deep link invite
  React.useEffect(() => {
    if (pendingRoomCode) {
      Alert.alert('Game Invite', `You've been invited to room ${pendingRoomCode}. Join?`, [
        { text: 'Decline', style: 'cancel', onPress: () => useGameStore.getState().setPendingRoomCode(null) },
        { text: 'Join', onPress: () => {
          useGameStore.getState().setPendingRoomCode(null);
          router.push('/(main)/join-room');
        }},
      ]);
    }
  }, [pendingRoomCode]);

  return (
    <Background style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Logo size="small" />
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={() => router.push('/(main)/friends')}>
              <Text style={styles.navIcon}>👥</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/(main)/profile')}>
              {user && <AvatarBubble avatarId={user.avatarId} avatarColor={user.avatarColor} size={36} />}
            </TouchableOpacity>
          </View>
        </View>

        {/* Greeting */}
        <View style={styles.greeting}>
          <Text style={styles.greetingText}>Hey, {user?.displayName || user?.username || 'Player'}</Text>
          <Text style={styles.greetingSubtext}>Ready to play?</Text>
        </View>

        {/* Main Actions */}
        <View style={styles.actions}>
          <Card onPress={() => router.push('/(main)/solo-practice')} style={styles.actionCard}>
            <View style={styles.actionContent}>
              <Text style={styles.actionEmoji}>🎯</Text>
              <View style={styles.actionTextContainer}>
                <Text style={styles.actionTitle}>Solo Practice</Text>
                <Text style={styles.actionSubtitle}>Play against AI bots</Text>
              </View>
              <Text style={styles.actionChevron}>›</Text>
            </View>
          </Card>

          <Card onPress={() => router.push('/(main)/create-room')} style={styles.actionCard}>
            <View style={styles.actionContent}>
              <Text style={styles.actionEmoji}>🎮</Text>
              <View style={styles.actionTextContainer}>
                <Text style={styles.actionTitle}>Create Game</Text>
                <Text style={styles.actionSubtitle}>Set up a match</Text>
              </View>
              <Text style={styles.actionChevron}>›</Text>
            </View>
          </Card>

          <Card onPress={() => router.push('/(main)/join-room')} style={styles.actionCard}>
            <View style={styles.actionContent}>
              <Text style={styles.actionEmoji}>🔗</Text>
              <View style={styles.actionTextContainer}>
                <Text style={styles.actionTitle}>Join Game</Text>
                <Text style={styles.actionSubtitle}>Enter a room code</Text>
              </View>
              <Text style={styles.actionChevron}>›</Text>
            </View>
          </Card>

          <Card onPress={() => router.push('/(main)/friends')} style={styles.actionCard}>
            <View style={styles.actionContent}>
              <Text style={styles.actionEmoji}>👥</Text>
              <View style={styles.actionTextContainer}>
                <Text style={styles.actionTitle}>Play with Friends</Text>
                <Text style={styles.actionSubtitle}>Find & invite friends</Text>
              </View>
              <Text style={styles.actionChevron}>›</Text>
            </View>
          </Card>
        </View>

        {/* Quick Stats */}
        {user && (
          <Card style={styles.statsCard}>
            <Text style={styles.statsTitle}>Your Stats</Text>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>0</Text>
                <Text style={styles.statLabel}>Games</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>0%</Text>
                <Text style={styles.statLabel}>Win Rate</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>0</Text>
                <Text style={styles.statLabel}>Wins</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => router.push('/(main)/detailed-stats')}>
              <Text style={styles.statsLink}>View Detailed Stats ›</Text>
            </TouchableOpacity>
          </Card>
        )}
      </ScrollView>
    </Background>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.xxl },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  navIcon: {
    fontSize: 24,
  },
  greeting: {
    marginBottom: spacing.xl,
  },
  greetingText: {
    color: colors.text,
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold as any,
  },
  greetingSubtext: {
    color: colors.textSecondary,
    fontSize: fontSize.base,
    marginTop: spacing.xs,
  },
  actions: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  actionCard: {
    padding: spacing.lg,
  },
  actionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionEmoji: {
    fontSize: 28,
    marginRight: spacing.md,
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold as any,
  },
  actionSubtitle: {
    color: colors.textTertiary,
    fontSize: fontSize.sm,
    marginTop: spacing.xs / 2,
  },
  actionChevron: {
    color: colors.textTertiary,
    fontSize: 24,
    fontWeight: fontWeight.bold as any,
  },
  statsCard: {
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  statsTitle: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold as any,
    marginBottom: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: spacing.md,
  },
  statItem: { alignItems: 'center' },
  statValue: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold as any },
  statLabel: { color: colors.textTertiary, fontSize: fontSize.xs, marginTop: spacing.xs / 2 },
  statDivider: { width: 1, height: 30, backgroundColor: colors.divider },
  statsLink: {
    color: colors.primary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium as any,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});