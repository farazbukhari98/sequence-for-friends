import React, { useEffect } from 'react';
import { Image, View, Text, StyleSheet, ScrollView, TouchableOpacity, Share } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';
import { PUBLIC_JOIN_BASE_URL } from '@/constants/api';
import { useGameStore } from '@/stores/gameStore';
import { useFriendsStore } from '@/stores/friendsStore';
import { Background } from '@/components/ui/Background';
import { HeaderBar } from '@/components/ui/HeaderBar';
import { Button, ButtonRow } from '@/components/ui/Button';
import { AvatarBubble } from '@/components/ui/Avatar';
import { ConnectionOverlay } from '@/components/ui/Shared';
import { Toast } from '@/components/ui/Toast';
import { SurfaceTexture } from '@/components/ui/GameTexture';
import { gameImages } from '@/constants/gameAssets';
import { hapticSelection, hapticWarning } from '@/lib/haptics';
import { colors, spacing, fontSize, fontWeight, radius, shadows } from '@/theme';
import { TEAM_COLORS, DIFFICULTY_INFO as DIFF } from '@/constants/board';
import type { BotDifficulty } from '@/types/game';

function formatSequenceMode(sequenceLength: number): string {
  return sequenceLength === 4 ? 'Blitz' : 'Standard';
}

function formatSeries(seriesLength: number): string {
  return seriesLength > 0 ? `Best of ${seriesLength}` : 'Single';
}

export default function LobbyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { sessionToken } = useAuthStore();
  const {
    roomInfo,
    gameState,
    playerId,
    connectionStatus,
    pendingTeamSwitchRequest,
    latestNotice,
    leaveRoom,
    toggleReady,
    startGame,
    addBot,
    kickPlayer,
    removeBot,
    requestTeamSwitch,
    respondToTeamSwitch,
    clearLatestNotice,
  } = useGameStore();
  const friendsStore = useFriendsStore();
  const [showBotPicker, setShowBotPicker] = React.useState(false);
  const [toast, setToast] = React.useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (sessionToken) friendsStore.loadFriends(sessionToken);
  }, [sessionToken]);

  useEffect(() => {
    if (roomInfo?.phase === 'in-game' || gameState?.phase === 'cutting' || gameState?.phase === 'playing') {
      router.replace('/(game)/game');
    }
  }, [router, roomInfo?.phase, gameState?.phase]);

  if (!roomInfo) {
    return (
      <Background style={styles.container}>
        <ConnectionOverlay status="connecting" />
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Loading room...</Text>
          <Button title="Leave" variant="secondary" onPress={() => { leaveRoom(); router.back(); }} />
        </View>
      </Background>
    );
  }

  const isHost = roomInfo.hostId === playerId;
  const myPlayer = roomInfo.players.find(p => p.id === playerId);
  const humanPlayers = roomInfo.players.filter(p => !p.isBot);
  const allReady = humanPlayers.every(p => p.ready);
  const canStart = isHost && roomInfo.players.length >= 2 && allReady;
  const teamColors = ['blue', 'green', 'red'].slice(0, roomInfo.teamCount);
  const playersByTeam = (teamIndex: number) => roomInfo.players.filter(p => p.teamIndex === teamIndex);

  const handleReady = () => toggleReady();
  const handleStart = () => startGame();
  const handleLeave = () => {
    leaveRoom();
    router.back();
  };

  const handleInviteFriend = async (friendId: string) => {
    if (!sessionToken || !roomInfo) return;
    const success = await friendsStore.inviteFriend(sessionToken, friendId, roomInfo.code);
    if (!success) hapticWarning();
    setToast({ message: success ? 'Invite sent!' : 'Failed to send invite', type: success ? 'success' : 'error' });
  };

  const handleAddBot = (difficulty: BotDifficulty) => {
    addBot(difficulty);
    setShowBotPicker(false);
  };

  const handleShareRoom = async () => {
    try {
      hapticSelection();
      await Share.share({
        message: `Join my Sequence game with code ${roomInfo.code}: ${PUBLIC_JOIN_BASE_URL}/join/${roomInfo.code}`,
        url: `${PUBLIC_JOIN_BASE_URL}/join/${roomInfo.code}`,
      });
    } catch (error: any) {
      hapticWarning();
      setToast({ message: error.message ?? 'Unable to share room', type: 'error' });
    }
  };

  if (connectionStatus.phase === 'offline' || connectionStatus.phase === 'terminalFailure') {
    return (
      <Background style={styles.container}>
        <ConnectionOverlay
          status={connectionStatus.phase === 'terminalFailure' ? 'error' : 'offline'}
          message={connectionStatus.message ?? undefined}
          onRetry={() => useGameStore.getState().reconnectToRoom(sessionToken)}
          onBack={handleLeave}
        />
      </Background>
    );
  }

  return (
    <Background style={styles.container}>
      <Toast message={toast?.message ?? null} type={toast?.type} onDismiss={() => setToast(null)} />
      <Toast message={latestNotice?.message ?? null} type={latestNotice?.type} onDismiss={clearLatestNotice} />

      <HeaderBar
        title="Game Lobby"
        onBack={handleLeave}
        rightAction={
          <TouchableOpacity onPress={handleShareRoom} style={styles.headerShare}>
            <Ionicons name="share-outline" size={20} color={colors.textDark} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.huge }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.inviteTicket}>
          <Image source={gameImages.cardsChipsVignette} style={styles.ticketArt} resizeMode="contain" />
          <SurfaceTexture variant="wood" intensity="medium" style={styles.panelTexture} />
          <View>
            <Text style={styles.ticketLabel}>Table Code</Text>
            <Text style={styles.ticketCode}>{roomInfo.code}</Text>
          </View>
          <TouchableOpacity style={styles.ticketShareButton} onPress={handleShareRoom}>
            <Ionicons name="copy-outline" size={18} color="#fff" />
            <Text style={styles.ticketShareText}>Share</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tableStatus}>
          <StatusChip label="Players" value={`${roomInfo.players.length}/${roomInfo.maxPlayers}`} />
          <StatusChip label="Teams" value={String(roomInfo.teamCount)} />
          <StatusChip label="Mode" value={formatSequenceMode(roomInfo.sequenceLength)} />
          <StatusChip label="Timer" value={roomInfo.turnTimeLimit > 0 ? `${roomInfo.turnTimeLimit}s` : 'Off'} />
          <StatusChip label="Series" value={formatSeries(roomInfo.seriesLength)} />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Player Trays</Text>
          <Text style={styles.sectionMeta}>{allReady ? 'Ready to deal' : 'Waiting'}</Text>
        </View>

        {teamColors.map((teamColor, teamIndex) => {
          const teamHex = TEAM_COLORS[teamColor]?.hex ?? colors.primary;
          const teamPlayers = playersByTeam(teamIndex);

          return (
            <View key={teamColor} style={[styles.teamTray, { borderColor: teamHex }]}>
              <SurfaceTexture variant="card" intensity="subtle" style={styles.cardTexture} />
              <View style={styles.teamHeader}>
                <View style={styles.teamTitleRow}>
                  <View style={[styles.teamChip, { backgroundColor: teamHex }]}>
                    <Text style={styles.teamChipText}>{TEAM_COLORS[teamColor]?.letter}</Text>
                  </View>
                  <View>
                    <Text style={styles.teamTitle}>Team {teamColor.charAt(0).toUpperCase() + teamColor.slice(1)}</Text>
                    <Text style={styles.teamCount}>{teamPlayers.length} seated</Text>
                  </View>
                </View>
                {roomInfo.phase === 'waiting' && myPlayer?.teamIndex !== teamIndex && (
                  <Button
                    title={isHost ? 'Move' : 'Switch'}
                    size="small"
                    variant="secondary"
                    onPress={() => requestTeamSwitch(teamIndex)}
                  />
                )}
              </View>

              {teamPlayers.length === 0 ? (
                <Text style={styles.emptyTeamText}>Open seat</Text>
              ) : (
                teamPlayers.map((player) => (
                  <View key={player.id} style={styles.playerRow}>
                    <AvatarBubble avatarId={player.name} avatarColor={teamHex} size={38} />
                    <View style={styles.playerInfo}>
                      <Text style={styles.playerName}>{player.name}{player.id === playerId ? ' (You)' : ''}</Text>
                      <Text style={styles.playerSubline}>{player.isBot ? 'Bot opponent' : player.connected ? 'At the table' : 'Disconnected'}</Text>
                    </View>
                    <View style={[styles.readyPill, player.ready && styles.readyPillActive]}>
                      <Text style={[styles.readyPillText, player.ready && styles.readyPillTextActive]}>
                        {player.ready ? 'Ready' : 'Wait'}
                      </Text>
                    </View>
                    {isHost && player.id !== playerId && (
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => {
                          hapticSelection();
                          player.isBot ? removeBot(player.id) : kickPlayer(player.id);
                        }}
                      >
                        <Ionicons name="close" size={16} color={colors.textDarkTertiary} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              )}
            </View>
          );
        })}

        {isHost && pendingTeamSwitchRequest && (
          <View style={styles.noticePanel}>
            <SurfaceTexture variant="card" intensity="subtle" style={styles.cardTexture} />
            <Text style={styles.noticeTitle}>Team Switch Request</Text>
            <Text style={styles.noticeText}>
              {pendingTeamSwitchRequest.playerName} wants to move to Team {teamColors[pendingTeamSwitchRequest.toTeamIndex]?.charAt(0).toUpperCase() + teamColors[pendingTeamSwitchRequest.toTeamIndex]?.slice(1)}
            </Text>
            <ButtonRow>
              <Button title="Decline" variant="secondary" onPress={() => respondToTeamSwitch(pendingTeamSwitchRequest.playerId, false)} />
              <Button title="Approve" onPress={() => respondToTeamSwitch(pendingTeamSwitchRequest.playerId, true)} />
            </ButtonRow>
          </View>
        )}

        {isHost && roomInfo.phase === 'waiting' && (
          <View style={styles.hostPanel}>
            <Image source={gameImages.cardsChipsVignette} style={styles.hostPanelArt} resizeMode="contain" />
            <SurfaceTexture variant="card" intensity="subtle" style={styles.cardTexture} />
            <View style={styles.sectionHeaderCompact}>
              <Text style={styles.panelTitle}>Host Controls</Text>
              <Text style={styles.panelMeta}>Classic</Text>
            </View>

            <View style={styles.rulesList}>
              <RuleRow label="Sequences to Win" value={String(roomInfo.sequencesToWin)} />
              <RuleRow label="Mode" value={formatSequenceMode(roomInfo.sequenceLength)} />
              <RuleRow label="Series" value={formatSeries(roomInfo.seriesLength)} />
              {roomInfo.seriesState && (
                <RuleRow
                  label="Series Score"
                  value={roomInfo.seriesState.teamWins.map((wins, index) => `T${index + 1}: ${wins}`).join('  ')}
                />
              )}
            </View>

            {showBotPicker ? (
              <View style={styles.botPicker}>
                <Text style={styles.botPickerTitle}>Add Bot Dealer</Text>
                <View style={styles.botOptions}>
                  {(['easy', 'medium', 'hard', 'impossible'] as BotDifficulty[]).map((d) => {
                    const info = DIFF[d];
                    return (
                      <TouchableOpacity key={d} style={styles.botOption} onPress={() => { hapticSelection(); handleAddBot(d); }}>
                        <View style={[styles.botOptionChip, { backgroundColor: info.color }]}>
                          <Ionicons name={info.icon as any} size={18} color="#fff" />
                        </View>
                        <Text style={styles.botLabel}>{info.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : (
              <Button title="Add Bot" variant="secondary" onPress={() => setShowBotPicker(true)} />
            )}
          </View>
        )}

        {friendsStore.friends.length > 0 && (
          <View style={styles.friendsPanel}>
            <SurfaceTexture variant="card" intensity="subtle" style={styles.cardTexture} />
            <Text style={styles.panelTitle}>Invite Friends</Text>
            {friendsStore.friends.slice(0, 5).map((friend) => (
              <View key={friend.userId} style={styles.inviteRow}>
                <View style={styles.friendIdentity}>
                  <AvatarBubble avatarId={friend.avatarId} avatarColor={friend.avatarColor} size={36} />
                  <Text style={styles.friendName}>{friend.displayName}</Text>
                </View>
                <Button title="Invite" variant="secondary" size="small" onPress={() => handleInviteFriend(friend.userId)} />
              </View>
            ))}
          </View>
        )}

        <ButtonRow style={styles.actions}>
          <Button
            title={myPlayer?.ready ? 'Ready' : 'Ready Up'}
            variant={myPlayer?.ready ? 'secondary' : 'primary'}
            onPress={handleReady}
          />
          {isHost && (
            <Button
              title="Deal Game"
              onPress={handleStart}
              disabled={!canStart}
            />
          )}
        </ButtonRow>
      </ScrollView>
    </Background>
  );
}

function StatusChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statusChip}>
      <Text style={styles.statusValue}>{value}</Text>
      <Text style={styles.statusLabel}>{label}</Text>
    </View>
  );
}

function RuleRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.ruleRow}>
      <Text style={styles.ruleLabel}>{label}</Text>
      <Text style={styles.ruleValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: spacing.lg },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  emptyText: { color: colors.textOnDarkSecondary, fontSize: fontSize.base, marginBottom: spacing.md },
  headerShare: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  inviteTicket: {
    backgroundColor: colors.primaryDark,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: '#4A2511',
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    position: 'relative',
    overflow: 'hidden',
    ...shadows.lg,
  },
  ticketArt: {
    position: 'absolute',
    right: -44,
    bottom: -64,
    width: 172,
    height: 172,
    opacity: 0.16,
  },
  ticketLabel: {
    color: colors.gold,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold as any,
    textTransform: 'uppercase',
  },
  ticketCode: {
    color: colors.textOnDark,
    fontSize: fontSize.huge,
    fontWeight: fontWeight.bold as any,
    letterSpacing: 4,
    marginTop: spacing.xs,
  },
  ticketShareButton: {
    minHeight: 44,
    borderRadius: radius.button,
    backgroundColor: colors.teamBlue,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 2,
    borderColor: '#fff',
  },
  ticketShareText: {
    color: '#fff',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold as any,
  },
  tableStatus: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  statusChip: {
    flexGrow: 1,
    flexBasis: '30%',
    minHeight: 70,
    borderRadius: radius.md,
    backgroundColor: '#E8DCC4',
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusValue: {
    color: colors.textDark,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold as any,
  },
  statusLabel: {
    color: colors.textDarkTertiary,
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionHeaderCompact: {
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
  teamTray: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.md,
    borderWidth: 3,
    padding: spacing.md,
    marginBottom: spacing.md,
    position: 'relative',
    overflow: 'hidden',
    ...shadows.md,
  },
  hostPanelArt: {
    position: 'absolute',
    right: -34,
    bottom: -46,
    width: 150,
    height: 150,
    opacity: 0.12,
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  teamTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  teamChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamChipText: {
    color: '#fff',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold as any,
  },
  teamTitle: {
    color: colors.textDark,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold as any,
  },
  teamCount: {
    color: colors.textDarkTertiary,
    fontSize: fontSize.xs,
    marginTop: spacing.xs / 2,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  playerInfo: { flex: 1, marginLeft: spacing.sm },
  playerName: { color: colors.textDark, fontSize: fontSize.base, fontWeight: fontWeight.bold as any },
  playerSubline: { color: colors.textDarkTertiary, fontSize: fontSize.xs, marginTop: 2 },
  readyPill: {
    minWidth: 56,
    minHeight: 28,
    borderRadius: 14,
    backgroundColor: colors.cardBgHover,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  readyPillActive: {
    backgroundColor: colors.success,
  },
  readyPillText: {
    color: colors.textDarkTertiary,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold as any,
  },
  readyPillTextActive: {
    color: '#fff',
  },
  removeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs,
  },
  emptyTeamText: { color: colors.textDarkTertiary, fontSize: fontSize.sm, textAlign: 'center', paddingVertical: spacing.md },
  noticePanel: {
    backgroundColor: '#E8DCC4',
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.warning,
    padding: spacing.lg,
    marginBottom: spacing.md,
    position: 'relative',
  },
  noticeTitle: {
    color: colors.textDark,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold as any,
    marginBottom: spacing.sm,
  },
  noticeText: {
    color: colors.textDarkSecondary,
    fontSize: fontSize.base,
    marginBottom: spacing.md,
  },
  hostPanel: {
    backgroundColor: '#E8DCC4',
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.primary,
    padding: spacing.lg,
    marginBottom: spacing.md,
    position: 'relative',
    ...shadows.md,
  },
  panelTitle: {
    color: colors.textDark,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold as any,
  },
  panelMeta: {
    color: colors.textDarkTertiary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold as any,
  },
  rulesList: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: spacing.md,
  },
  ruleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  ruleLabel: { color: colors.textDarkSecondary, fontSize: fontSize.sm },
  ruleValue: { color: colors.textDark, fontSize: fontSize.sm, fontWeight: fontWeight.bold as any },
  botPicker: {
    gap: spacing.md,
  },
  botPickerTitle: {
    color: colors.textDarkSecondary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold as any,
  },
  botOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  botOption: {
    width: '47.8%',
    minHeight: 72,
    borderRadius: radius.md,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  botOptionChip: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botLabel: { color: colors.textDark, fontSize: fontSize.xs, fontWeight: fontWeight.bold as any },
  friendsPanel: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    marginBottom: spacing.md,
    position: 'relative',
    ...shadows.md,
  },
  panelTexture: {
    opacity: 0.24,
  },
  cardTexture: {
    opacity: 0.28,
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  friendIdentity: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  friendName: { color: colors.textDark, fontSize: fontSize.base, marginLeft: spacing.sm, fontWeight: fontWeight.semibold as any },
  actions: { paddingTop: spacing.md, paddingBottom: spacing.xl },
});
