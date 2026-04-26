import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';
import { useFriendsStore } from '@/stores/friendsStore';
import { useGameStore } from '@/stores/gameStore';
import { Background } from '@/components/ui/Background';
import { HeaderBar } from '@/components/ui/HeaderBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { AvatarBubble } from '@/components/ui/Avatar';
import { StatValue, TeamDot } from '@/components/ui/StatValue';
import { colors, spacing, fontSize, fontWeight } from '@/theme';

export default function FriendProfileScreen() {
  const router = useRouter();
  const { sessionToken } = useAuthStore();
  const { viewingProfile, viewingDetailedStats, headToHead, loadDetailedStats, loadHeadToHead } = useFriendsStore();
  const { roomCode } = useGameStore();
  const inviteFriend = useFriendsStore((state) => state.inviteFriend);

  useEffect(() => {
    if (sessionToken && viewingProfile) {
      loadDetailedStats(sessionToken, viewingProfile.user.username);
      loadHeadToHead(sessionToken, viewingProfile.user.id);
    }
  }, [sessionToken, viewingProfile?.user?.id]);

  if (!viewingProfile) {
    return (
      <Background style={styles.container}>
        <HeaderBar title="Profile" onBack={() => router.back()} />
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No profile loaded</Text>
        </View>
      </Background>
    );
  }

  const { user, stats, friendStatus, friendCount } = viewingProfile;
  const o = stats;

  return (
    <Background style={styles.container}>
      <HeaderBar title="Friend Profile" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <Card style={styles.profileCard}>
          <View style={styles.profileRow}>
            <AvatarBubble avatarId={user.avatarId} avatarColor={user.avatarColor} size={72} showBorder />
            <View style={styles.profileInfo}>
              <Text style={styles.displayName}>{user.displayName}</Text>
              <Text style={styles.username}>@{user.username}</Text>
              <View style={styles.badges}>
                {friendStatus === 'friends' && (
                  <View style={styles.badgeRow}>
                    <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                    <Text style={styles.friendBadge}>Friends</Text>
                  </View>
                )}
                {o?.hasBeatImpossibleBot && (
                  <View style={styles.badgeRow}>
                    <Ionicons name="skull" size={14} color={colors.purple} />
                    <Text style={styles.impossibleBadge}>Beat Impossible</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
          <View style={styles.miniStats}>
            <StatValue value={o?.gamesPlayed ?? 0} label="Games" />
            <StatValue value={o?.winRate ? `${Math.round(o.winRate * 100)}%` : '0%'} label="Win Rate" />
            <StatValue value={friendCount ?? 0} label="Friends" />
          </View>
        </Card>

        {/* Head to Head */}
        {headToHead && (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Head to Head</Text>
            <View style={styles.h2hRow}>
              <Text style={styles.h2hLabel}>Games Together</Text>
              <Text style={styles.h2hValue}>{headToHead.gamesPlayed}</Text>
            </View>
            <View style={styles.h2hRow}>
              <Text style={styles.h2hLabel}>Same Team Wins</Text>
              <Text style={styles.h2hValue}>{headToHead.sameTeamWins}</Text>
            </View>
            <View style={styles.h2hRow}>
              <Text style={styles.h2hLabel}>My Wins vs Them</Text>
              <Text style={styles.h2hValue}>{headToHead.myWins}</Text>
            </View>
          </Card>
        )}

        {/* Stats Summary */}
        {o && (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Stats</Text>
            <View style={styles.statsRow}>
              <StatValue value={o.gamesWon} label="Wins" />
              <StatValue value={o.gamesLost} label="Losses" />
              <StatValue value={o.sequencesCompleted} label="Sequences" />
            </View>
            <View style={styles.statsRow}>
              <StatValue value={o.currentWinStreak} label="Streak" />
              <StatValue value={o.longestWinStreak} label="Best Streak" />
              <StatValue value={o.twoEyedJacksUsed + o.oneEyedJacksUsed} label="Jacks Used" />
            </View>
          </Card>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          {friendStatus === 'friends' && (
            <Button
              title="Invite to Game"
              variant="secondary"
              disabled={!roomCode}
              onPress={async () => {
                if (!sessionToken || !roomCode) {
                  Alert.alert('No Active Room', 'Create or join a room before inviting a friend.');
                  return;
                }
                const success = await inviteFriend(sessionToken, user.id, roomCode);
                Alert.alert(success ? 'Invite Sent' : 'Invite Failed', success ? `${user.displayName} was invited to room ${roomCode}.` : 'Could not send the invite.');
              }}
            />
          )}
          <TouchableOpacity onPress={() => router.push('/(main)/detailed-stats')}>
            <Text style={styles.viewMoreLink}>View All Stats ›</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Background>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.huge },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: colors.textOnDarkSecondary },
  profileCard: { padding: spacing.lg, marginBottom: spacing.md },
  profileRow: { flexDirection: 'row', alignItems: 'center' },
  profileInfo: { flex: 1, marginLeft: spacing.lg },
  displayName: { color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.bold as any },
  username: { color: colors.textSecondary, fontSize: fontSize.base, marginTop: spacing.xs / 2 },
  badges: { flexDirection: 'row', marginTop: spacing.sm, gap: spacing.md },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  friendBadge: { color: colors.success, fontSize: fontSize.sm, fontWeight: fontWeight.medium as any },
  impossibleBadge: { color: colors.purple, fontSize: fontSize.sm, fontWeight: fontWeight.medium as any },
  miniStats: { flexDirection: 'row', justifyContent: 'space-around', marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider },
  card: { padding: spacing.lg, marginBottom: spacing.md },
  cardTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.semibold as any, marginBottom: spacing.md },
  h2hRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
  h2hLabel: { color: colors.textSecondary, fontSize: fontSize.base },
  h2hValue: { color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.semibold as any },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: spacing.sm },
  actions: { marginTop: spacing.xl },
  viewMoreLink: { color: colors.gold, fontSize: fontSize.base, fontWeight: fontWeight.medium as any, textAlign: 'center', marginTop: spacing.md },
});
