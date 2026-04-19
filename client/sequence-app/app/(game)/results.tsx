import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useGameStore } from '@/stores/gameStore';
import { Background } from '@/components/ui/Background';
import { Button } from '@/components/ui/Button';
import { AvatarBubble } from '@/components/ui/Avatar';
import { colors, spacing, fontSize, fontWeight } from '@/theme';
import { TEAM_COLORS } from '@/constants/board';
import type { TeamColor } from '@/types/game';

export default function ResultsScreen() {
  const router = useRouter();
  const { gameState, roomInfo, winnerInfo, leaveRoom } = useGameStore();

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

  return (
    <Background style={styles.container}>
      <View style={styles.content}>
        {/* Result banner */}
        <View style={[styles.banner, { backgroundColor: winnerTeamHex + '20' }]}>
          <Text style={styles.resultEmoji}>{didWin ? '🏆' : '😔'}</Text>
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
                <Text style={styles.winnerBadge}>🏆</Text>
              )}
            </View>
          ))}
        </View>

        {/* Series state */}
        {roomInfo?.seriesState && roomInfo.seriesState.seriesLength > 1 && (
          <View style={styles.seriesContainer}>
            <Text style={styles.sectionTitle}>Series Progress</Text>
            <Text style={styles.seriesText}>
              Game {roomInfo.seriesState.gamesPlayed} of {roomInfo.seriesState.seriesLength}
            </Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <Button title="Back to Home" onPress={() => { leaveRoom(); router.push('/(main)/home'); }} />
        </View>
      </View>
    </Background>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: colors.textSecondary, fontSize: fontSize.lg, marginBottom: spacing.xl },
  content: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.xxl },
  banner: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    borderRadius: 20,
    marginBottom: spacing.xl,
  },
  resultEmoji: { fontSize: 64, marginBottom: spacing.md },
  resultTitle: { color: colors.text, fontSize: fontSize.huge, fontWeight: fontWeight.bold as any },
  resultTeam: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold as any, marginTop: spacing.sm },
  scoresContainer: { marginBottom: spacing.xl },
  scoreRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, gap: spacing.sm },
  scoreDot: { width: 12, height: 12, borderRadius: 6 },
  scoreTeamName: { color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.medium as any, flex: 1 },
  scoreValue: { color: colors.textSecondary, fontSize: fontSize.base },
  sectionTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.semibold as any, marginBottom: spacing.md },
  playersContainer: { marginBottom: spacing.xl },
  playerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  playerInfo: { flex: 1, marginLeft: spacing.md },
  playerName: { color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.medium as any },
  playerTeam: { fontSize: fontSize.sm },
  winnerBadge: { fontSize: 20 },
  seriesContainer: { marginBottom: spacing.xl, padding: spacing.lg, backgroundColor: colors.cardBg, borderRadius: 14 },
  seriesText: { color: colors.textSecondary, fontSize: fontSize.base },
  actions: { marginTop: 'auto', paddingBottom: spacing.xxl },
});