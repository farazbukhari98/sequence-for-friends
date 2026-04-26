import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGameStore } from '@/stores/gameStore';
import { Background } from '@/components/ui/Background';
import { Button } from '@/components/ui/Button';
import { AvatarBubble } from '@/components/ui/Avatar';
import { colors, spacing, fontSize, fontWeight } from '@/theme';
import { TEAM_COLORS } from '@/constants/board';
import type { TeamColor } from '@/types/game';

export default function ResultsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { gameState, roomInfo, playerId, winnerInfo, leaveRoom, continueSeries, endSeries } = useGameStore();
  const [actionError, setActionError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (gameState?.phase === 'playing') {
      router.replace('/(game)/game');
    }
  }, [gameState?.phase, router]);

  if (!gameState && !winnerInfo) {
    return (
      <Background style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No game results</Text>
          <Button title="Home" onPress={() => { leaveRoom(); router.push('/(main)/home'); }} />
        </View>
      </Background>
    );
  }

  const winnerTeamColor = winnerInfo?.teamColor ?? (gameState?.winnerTeamIndex !== null ? (gameState?.config.teamColors[gameState!.winnerTeamIndex!] as TeamColor) : 'blue');
  const winnerTeamHex = TEAM_COLORS[winnerTeamColor]?.hex ?? colors.primary;
  const myTeamIndex = gameState?.players.find(p => p.id === gameState.myPlayerId)?.teamIndex;
  const didWin = myTeamIndex === gameState?.winnerTeamIndex;
  const isHost = roomInfo?.hostId === playerId;
  const seriesState = roomInfo?.seriesState ?? null;
  const pendingWinnerTeamIndex = gameState?.winnerTeamIndex ?? winnerInfo?.teamIndex ?? null;
  const shouldCountPendingGame = Boolean(gameState && seriesState && seriesState.seriesWinnerTeamIndex === null);
  const projectedSeriesWins = seriesState
    ? seriesState.teamWins.map((wins, index) => wins + (pendingWinnerTeamIndex === index && shouldCountPendingGame ? 1 : 0))
    : [];
  const winsNeeded = seriesState ? Math.ceil(seriesState.seriesLength / 2) : 0;
  const projectedSeriesWinner = seriesState
    ? (seriesState.seriesWinnerTeamIndex ?? projectedSeriesWins.findIndex(wins => wins >= winsNeeded))
    : -1;
  const hasProjectedSeriesWinner = projectedSeriesWinner >= 0;
  const seriesCanContinue = Boolean(
    isHost &&
    seriesState &&
    seriesState.seriesLength > 1 &&
    !hasProjectedSeriesWinner,
  );
  const seriesNeedsFinalization = Boolean(
    isHost &&
    seriesState &&
    seriesState.seriesLength > 1 &&
    seriesState.seriesWinnerTeamIndex === null &&
    hasProjectedSeriesWinner,
  );

  const handleContinueSeries = async () => {
    try {
      const result = await continueSeries();
      if (!result.seriesComplete) {
        router.replace('/(game)/game');
      }
    } catch (error: any) {
      setActionError(error.message ?? 'Could not continue series');
    }
  };

  const handleEndSeries = async () => {
    try {
      await endSeries();
      router.replace('/(game)/lobby');
    } catch (error: any) {
      setActionError(error.message ?? 'Could not end series');
    }
  };

  return (
    <Background style={styles.container}>
      <View style={[styles.content, { paddingTop: Math.max(spacing.xxl, insets.top + spacing.md), paddingBottom: insets.bottom + spacing.xl }]}>
        {actionError && <Text style={styles.errorText}>{actionError}</Text>}
        {/* Result banner */}
        <View style={[styles.banner, { backgroundColor: winnerTeamHex + '20' }]}>
          <Ionicons
            name={didWin ? 'trophy' : 'sad-outline'}
            size={64}
            color={didWin ? colors.gold : colors.textTertiary}
            style={styles.resultIcon}
          />
          <Text style={styles.resultTitle}>{didWin ? 'Victory!' : 'Defeat'}</Text>
          <Text style={[styles.resultTeam, { color: winnerTeamHex }]}>
            {winnerTeamColor.charAt(0).toUpperCase() + winnerTeamColor.slice(1)} team wins!
          </Text>
        </View>

        {/* Scores */}
        <View style={styles.scoresContainer}>
          {gameState?.config.teamColors.map((tc, i) => {
            const score = gameState.teamScores[i] ?? 0;
            const seqs = gameState.sequencesCompleted[i] ?? 0;
            return (
              <View key={tc} style={styles.scoreRow}>
                <View style={[styles.scoreDot, { backgroundColor: TEAM_COLORS[tc]?.hex }]} />
                <Text style={styles.scoreTeamName}>{tc.charAt(0).toUpperCase() + tc.slice(1)}</Text>
                <Text style={styles.scoreValue}>{score} pts · {seqs} seq</Text>
              </View>
            );
          })}
        </View>

        {/* Players */}
        <View style={styles.playersContainer}>
          <Text style={styles.sectionTitle}>Players</Text>
          {gameState?.players.map((player) => (
            <View key={player.id} style={styles.playerRow}>
              <AvatarBubble
                avatarId={player.name}
                avatarColor={TEAM_COLORS[player.teamColor]?.hex ?? colors.primary}
                size={36}
              />
              <View style={styles.playerInfo}>
                <Text style={styles.playerName}>{player.name}{player.id === gameState.myPlayerId ? ' (You)' : ''}</Text>
                <Text style={[styles.playerTeam, { color: TEAM_COLORS[player.teamColor]?.hex }]}>
                  {player.teamColor} team
                </Text>
              </View>
              {gameState.winnerTeamIndex === player.teamIndex && (
                <Ionicons name="trophy" size={20} color={colors.gold} />
              )}
            </View>
          ))}
        </View>

        {/* Series state */}
        {seriesState && seriesState.seriesLength > 1 && (
          <View style={styles.seriesContainer}>
            <Text style={styles.sectionTitle}>Series Progress</Text>
            <Text style={styles.seriesText}>
              Game {Math.min(seriesState.gamesPlayed + (shouldCountPendingGame ? 1 : 0), seriesState.seriesLength)} of {seriesState.seriesLength}
            </Text>
            <Text style={styles.seriesScoreText}>
              {projectedSeriesWins.map((wins, index) => `Team ${index + 1}: ${wins}`).join('   ')}
            </Text>
            {hasProjectedSeriesWinner && (
              <Text style={[styles.seriesWinnerText, { color: TEAM_COLORS[gameState?.config.teamColors[projectedSeriesWinner] ?? winnerTeamColor]?.hex ?? winnerTeamHex }]}>
                Team {projectedSeriesWinner + 1} wins the series
              </Text>
            )}
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          {seriesCanContinue && (
            <>
              <Button title="Continue Series" onPress={handleContinueSeries} />
              <Button title="End Series" variant="secondary" onPress={handleEndSeries} />
            </>
          )}
          {seriesNeedsFinalization && (
            <Button title="Finish Series" onPress={handleContinueSeries} />
          )}
          <Button title="Back to Home" onPress={() => { leaveRoom(); router.push('/(main)/home'); }} />
        </View>
      </View>
    </Background>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: colors.textOnDarkSecondary, fontSize: fontSize.lg, marginBottom: spacing.xl },
  content: { flex: 1, paddingHorizontal: spacing.xl },
  errorText: { color: colors.errorLight, fontSize: fontSize.sm, textAlign: 'center', marginBottom: spacing.md },
  banner: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    borderRadius: 20,
    marginBottom: spacing.xl,
  },
  resultIcon: { marginBottom: spacing.md },
  resultTitle: { color: colors.textOnDark, fontSize: fontSize.huge, fontWeight: fontWeight.bold as any },
  resultTeam: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold as any, marginTop: spacing.sm },
  scoresContainer: { marginBottom: spacing.xl },
  scoreRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, gap: spacing.sm },
  scoreDot: { width: 12, height: 12, borderRadius: 6 },
  scoreTeamName: { color: colors.textOnDark, fontSize: fontSize.base, fontWeight: fontWeight.medium as any, flex: 1 },
  scoreValue: { color: colors.textOnDarkSecondary, fontSize: fontSize.base },
  sectionTitle: { color: colors.textOnDark, fontSize: fontSize.md, fontWeight: fontWeight.semibold as any, marginBottom: spacing.md },
  playersContainer: { marginBottom: spacing.xl },
  playerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  playerInfo: { flex: 1, marginLeft: spacing.md },
  playerName: { color: colors.textOnDark, fontSize: fontSize.base, fontWeight: fontWeight.medium as any },
  playerTeam: { fontSize: fontSize.sm },
  seriesContainer: { marginBottom: spacing.xl, padding: spacing.lg, backgroundColor: colors.cardBg, borderRadius: 14 },
  seriesText: { color: colors.textSecondary, fontSize: fontSize.base },
  seriesScoreText: { color: colors.textDark, fontSize: fontSize.base, fontWeight: fontWeight.semibold as any, marginTop: spacing.sm },
  seriesWinnerText: { fontSize: fontSize.base, fontWeight: fontWeight.bold as any, marginTop: spacing.sm },
  actions: { marginTop: 'auto', gap: spacing.sm },
});
