import React, { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useFriendsStore } from '@/stores/friendsStore';
import { Background } from '@/components/ui/Background';
import { HeaderBar } from '@/components/ui/HeaderBar';
import { Card } from '@/components/ui/Card';
import { GameHistoryRow } from '@/components/ui/Shared';
import { colors, spacing, fontSize, fontWeight } from '@/theme';
import type { GameHistoryGame } from '@/types/game';

export default function GameHistoryScreen() {
  const router = useRouter();
  const { sessionToken } = useAuthStore();
  const friendsStore = useFriendsStore();
  const { gameHistoryList, isLoadingHistory, loadGameHistory } = friendsStore;

  useEffect(() => {
    if (sessionToken) {
      loadGameHistory(sessionToken, false);
    }
  }, [sessionToken]);

  const handleLoadMore = () => {
    if (sessionToken && !isLoadingHistory) {
      loadGameHistory(sessionToken, true);
    }
  };

  const renderGame = ({ item }: { item: GameHistoryGame }) => {
    const myParticipant = item.participants.find(p => p.user_id === useAuthStore.getState().user?.id);
    return (
      <GameHistoryRow
        won={(myParticipant?.won ?? 0) === 1}
        gameVariant={item.game_variant}
        botDifficulty={item.bot_difficulty}
        myTeamColor={myParticipant?.team_color ?? 'blue'}
        playerCount={item.player_count}
        durationMs={item.duration_ms}
        endedAt={item.ended_at}
      />
    );
  };

  return (
    <Background style={styles.container}>
      <HeaderBar title="Game History" onBack={() => router.back()} />
      <FlatList
        data={gameHistoryList}
        keyExtractor={(item) => item.id}
        renderItem={renderGame}
        contentContainerStyle={styles.list}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🎮</Text>
            <Text style={styles.emptyTitle}>No Games Yet</Text>
            <Text style={styles.emptySubtext}>Your game history will appear here</Text>
          </View>
        }
      />
    </Background>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  emptyState: { alignItems: 'center', paddingVertical: spacing.huge },
  emptyEmoji: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.semibold as any },
  emptySubtext: { color: colors.textTertiary, fontSize: fontSize.base, marginTop: spacing.sm },
});