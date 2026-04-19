import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useFriendsStore } from '@/stores/friendsStore';
import { Background } from '@/components/ui/Background';
import { HeaderBar } from '@/components/ui/HeaderBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { AvatarBubble } from '@/components/ui/Avatar';
import { StatValue, StatRow } from '@/components/ui/StatValue';
import { colors, spacing, fontSize, fontWeight } from '@/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, sessionToken, signOut } = useAuthStore();
  const friendsStore = useFriendsStore();
  const [stats, setStats] = React.useState<any>(null);

  useEffect(() => {
    if (sessionToken) {
      friendsStore.loadDetailedStats(sessionToken).then(() => {
        setStats(friendsStore.viewingDetailedStats);
      });
    }
  }, [sessionToken]);

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => {
        await signOut();
      }},
    ]);
  };

  if (!user) return null;

  return (
    <Background style={styles.container}>
      <HeaderBar title="Profile" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <Card style={styles.profileCard}>
          <View style={styles.profileRow}>
            <AvatarBubble avatarId={user.avatarId} avatarColor={user.avatarColor} size={64} showBorder />
            <View style={styles.profileInfo}>
              <Text style={styles.displayName}>{user.displayName}</Text>
              <Text style={styles.username}>@{user.username}</Text>
            </View>
          </View>
        </Card>

        {/* Quick Stats */}
        <Card style={styles.statsCard}>
          <Text style={styles.sectionTitle}>Quick Stats</Text>
          <StatRow stats={[
            { value: stats?.overall?.gamesPlayed ?? 0, label: 'Games' },
            { value: stats?.overall?.winRate ? `${Math.round(stats.overall.winRate * 100)}%` : '0%', label: 'Win Rate' },
            { value: stats?.overall?.currentWinStreak ?? 0, label: 'Streak' },
          ]} />
        </Card>

        {/* Detailed Stats */}
        <TouchableOpacity onPress={() => router.push('/(main)/detailed-stats')}>
          <Card style={styles.linkCard}>
            <Text style={styles.linkTitle}>📊 Detailed Stats</Text>
            <Text style={styles.linkChevron}>›</Text>
          </Card>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/(main)/game-history')}>
          <Card style={styles.linkCard}>
            <Text style={styles.linkTitle}>📋 Game History</Text>
            <Text style={styles.linkChevron}>›</Text>
          </Card>
        </TouchableOpacity>

        {/* Sign Out */}
        <Button title="Sign Out" variant="danger" onPress={handleSignOut} style={styles.signOutButton} />
      </ScrollView>
    </Background>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.huge },
  profileCard: { padding: spacing.lg, marginBottom: spacing.md },
  profileRow: { flexDirection: 'row', alignItems: 'center' },
  profileInfo: { flex: 1, marginLeft: spacing.lg },
  displayName: { color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.bold as any },
  username: { color: colors.textSecondary, fontSize: fontSize.base, marginTop: spacing.xs / 2 },
  statsCard: { padding: spacing.lg, marginBottom: spacing.md },
  sectionTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.semibold as any, marginBottom: spacing.md },
  linkCard: { padding: spacing.lg, marginBottom: spacing.sm, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  linkTitle: { color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.medium as any },
  linkChevron: { color: colors.textTertiary, fontSize: 24 },
  signOutButton: { marginTop: spacing.xl },
});