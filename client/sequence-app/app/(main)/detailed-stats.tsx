import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useFriendsStore } from '@/stores/friendsStore';
import { Background } from '@/components/ui/Background';
import { HeaderBar } from '@/components/ui/HeaderBar';
import { Card } from '@/components/ui/Card';
import { StatValue, StatCard } from '@/components/ui/StatValue';
import { colors, spacing, fontSize, fontWeight } from '@/theme';
import { formatDuration } from '@/types/game';

export default function DetailedStatsScreen() {
  const router = useRouter();
  const { sessionToken } = useAuthStore();
  const { viewingDetailedStats, loadDetailedStats } = useFriendsStore();
  const stats = viewingDetailedStats;

  useEffect(() => {
    if (sessionToken) loadDetailedStats(sessionToken);
  }, [sessionToken]);

  if (!stats) {
    return (
      <Background style={styles.container}>
        <HeaderBar title="Detailed Stats" onBack={() => router.back()} />
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Loading stats...</Text>
        </View>
      </Background>
    );
  }

  const o = stats.overall;
  const formatMs = (ms: number | null) => ms ? formatDuration(ms) : '—';
  const pct = (v: number | null) => v !== null ? `${Math.round(v * 100)}%` : '—';

  return (
    <Background style={styles.container}>
      <HeaderBar title="Detailed Stats" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Overall Stats */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Overall</Text>
          <View style={styles.statsGrid}>
            <StatValue value={o.gamesPlayed} label="Games" />
            <StatValue value={o.gamesWon} label="Wins" />
            <StatValue value={pct(o.winRate)} label="Win Rate" />
            <StatValue value={o.currentWinStreak} label="Streak" />
            <StatValue value={o.longestWinStreak} label="Best Streak" />
            <StatValue value={o.sequencesCompleted} label="Sequences" />
            <StatValue value={o.cardsPlayed} label="Cards Played" />
            <StatValue value={o.twoEyedJacksUsed} label="Wild Jacks" />
            <StatValue value={o.oneEyedJacksUsed} label="Remove Jacks" />
            <StatValue value={formatMs(o.totalPlayTimeMs)} label="Play Time" />
          </View>
        </Card>

        {/* Bot Difficulty */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Vs. Bots</Text>
          {stats.byMode.botEasy && <StatCard value={stats.byMode.botEasy.gamesWon} label={`Easy Wins (${pct(stats.byMode.botEasy.winRate)})`} color={colors.success} />}
          {stats.byMode.botMedium && <StatCard value={stats.byMode.botMedium.gamesWon} label={`Medium Wins (${pct(stats.byMode.botMedium.winRate)})`} color={colors.warning} />}
          {stats.byMode.botHard && <StatCard value={stats.byMode.botHard.gamesWon} label={`Hard Wins (${pct(stats.byMode.botHard.winRate)})`} color={colors.error} />}
          {stats.byMode.botImpossible && <StatCard value={stats.byMode.botImpossible.gamesWon} label={`Impossible Wins (${pct(stats.byMode.botImpossible.winRate)})`} color={colors.purple} />}
          {!stats.byMode.botEasy && !stats.byMode.botMedium && !stats.byMode.botHard && !stats.byMode.botImpossible && (
            <Text style={styles.emptyText}>No bot games yet</Text>
          )}
        </Card>

        {/* Series Stats */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Series</Text>
          <View style={styles.statsGrid}>
            <StatValue value={stats.series.played} label="Played" />
            <StatValue value={stats.series.won} label="Won" />
            <StatValue value={pct(stats.series.winRate)} label="Win Rate" />
          </View>
        </Card>

        {/* Insights */}
        {stats.insights && (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Insights</Text>
            <Text style={styles.insightItem}>⏱️ Avg game duration: {formatMs(stats.insights.avgGameDurationMs)}</Text>
            <Text style={styles.insightItem}>🎯 Jack usage rate: {pct(stats.insights.jackUsageRate)}</Text>
            <Text style={styles.insightItem}>⚡ First move win rate: {pct(stats.insights.firstMoveWinRate)}</Text>
            <Text style={styles.insightItem}>🕐 Total play time: {stats.insights.totalPlayTimeFormatted}</Text>
          </Card>
        )}
      </ScrollView>
    </Background>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.huge },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: colors.textSecondary, fontSize: fontSize.base },
  card: { padding: spacing.lg, marginBottom: spacing.md },
  cardTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.semibold as any, marginBottom: spacing.md },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around' },
  emptyText: { color: colors.textTertiary, fontSize: fontSize.sm, textAlign: 'center', paddingVertical: spacing.md },
  insightItem: { color: colors.textSecondary, fontSize: fontSize.base, paddingVertical: spacing.xs },
});