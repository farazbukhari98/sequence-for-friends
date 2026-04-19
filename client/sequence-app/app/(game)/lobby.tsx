import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useGameStore } from '@/stores/gameStore';
import { useFriendsStore } from '@/stores/friendsStore';
import { Background } from '@/components/ui/Background';
import { HeaderBar } from '@/components/ui/HeaderBar';
import { Card } from '@/components/ui/Card';
import { Button, ButtonRow } from '@/components/ui/Button';
import { AvatarBubble } from '@/components/ui/Avatar';
import { Stepper } from '@/components/ui/SegmentPicker';
import { ConnectionOverlay } from '@/components/ui/Shared';
import { Toast } from '@/components/ui/Toast';
import { colors, spacing, fontSize, fontWeight, radius } from '@/theme';
import { TEAM_COLORS, DIFFICULTY_INFO as DIFF } from '@/constants/board';
import type { PublicPlayer, BotDifficulty } from '@/types/game';

export default function LobbyScreen() {
  const router = useRouter();
  const { user, sessionToken } = useAuthStore();
  const { roomInfo, playerId, connectionStatus, leaveRoom, toggleReady, startGame, updateRoomSettings, addBot, kickPlayer } = useGameStore();
  const friendsStore = useFriendsStore();
  const [showBotPicker, setShowBotPicker] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Load friends for inviting
  useEffect(() => {
    if (sessionToken) friendsStore.loadFriends(sessionToken);
  }, [sessionToken]);

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
  const allReady = roomInfo.players.filter(p => !p.isBot).every(p => p.ready);
  const canStart = isHost && roomInfo.players.length >= 2 && allReady;

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
    if (success) {
      setErrorMessage('Invite sent!');
    } else {
      setErrorMessage('Failed to send invite');
    }
  };

  const handleAddBot = (difficulty: BotDifficulty) => {
    addBot(difficulty);
    setShowBotPicker(false);
  };

  // Watch for game starting — transition to game screen
  React.useEffect(() => {
    if (roomInfo?.phase === 'playing' || roomInfo?.phase === 'cutting') {
      router.push('/(game)/game');
    }
  }, [roomInfo?.phase]);

  // Show connection overlay if disconnected
  if (connectionStatus.phase === 'offline' || connectionStatus.phase === 'terminalFailure') {
    return (
      <Background style={styles.container}>
        <ConnectionOverlay
          status={connectionStatus.phase === 'terminalFailure' ? 'error' : 'offline'}
          message={connectionStatus.message ?? undefined}
          onRetry={() => useGameStore.getState().reconnectToRoom(sessionToken!)}
          onBack={handleLeave}
        />
      </Background>
    );
  }

  const teamColors = ['blue', 'green', 'red'].slice(0, roomInfo.teamCount);

  return (
    <Background style={styles.container}>
      <Toast message={errorMessage} type="success" onDismiss={() => setErrorMessage(null)} />

      <HeaderBar
        title={`Room ${roomInfo.code}`}
        onBack={handleLeave}
        rightAction={
          <TouchableOpacity onPress={() => {/* Share room code */}}>
            <Text style={styles.shareIcon}>📤</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Room Code */}
        <Card style={styles.codeCard}>
          <Text style={styles.codeLabel}>Room Code</Text>
          <Text style={styles.codeValue}>{roomInfo.code}</Text>
          <Text style={styles.codeHint}>Share this code with friends to join</Text>
        </Card>

        {/* Teams */}
        {teamColors.map((teamColor, teamIndex) => (
          <Card key={teamColor} style={styles.teamCard}>
            <View style={[styles.teamHeader, { borderLeftColor: TEAM_COLORS[teamColor]?.hex ?? colors.primary }]}>
              <Text style={styles.teamTitle}>Team {teamColor.charAt(0).toUpperCase() + teamColor.slice(1)}</Text>
              <Text style={styles.teamCount}>{playersByTeam(teamIndex).length} player{playersByTeam(teamIndex).length !== 1 ? 's' : ''}</Text>
            </View>
            {playersByTeam(teamIndex).map((player) => (
              <View key={player.id} style={styles.playerRow}>
                <AvatarBubble avatarId={player.name} avatarColor={TEAM_COLORS[teamColor]?.hex ?? colors.primary} size={36} />
                <View style={styles.playerInfo}>
                  <Text style={styles.playerName}>{player.name}{player.id === playerId ? ' (You)' : ''}</Text>
                  {player.isBot && <Text style={styles.playerBotLabel}>🤖 {player.isBot === true ? 'Bot' : ''}</Text>}
                </View>
                <View style={styles.playerStatus}>
                  {player.ready ? (
                    <Text style={styles.readyBadge}>✓ Ready</Text>
                  ) : (
                    <Text style={styles.notReadyBadge}>Not ready</Text>
                  )}
                </View>
                {isHost && player.id !== playerId && !player.isBot && (
                  <TouchableOpacity onPress={() => kickPlayer(player.id)}>
                    <Text style={styles.kickButton}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
            {playersByTeam(teamIndex).length === 0 && (
              <Text style={styles.emptyTeamText}>No players yet</Text>
            )}
          </Card>
        ))}

        {/* Host Settings */}
        {isHost && roomInfo.phase === 'lobby' && (
          <Card style={styles.settingsCard}>
            <Text style={styles.sectionTitle}>Settings</Text>
            <View style={styles.settingsRow}>
              <Text style={styles.settingsLabel}>Turn Timer</Text>
              <Text style={styles.settingsValue}>{roomInfo.turnTimeLimit}s</Text>
            </View>
            <View style={styles.settingsRow}>
              <Text style={styles.settingsLabel}>Sequences to Win</Text>
              <Text style={styles.settingsValue}>{roomInfo.sequencesToWin}</Text>
            </View>
            <View style={styles.settingsRow}>
              <Text style={styles.settingsLabel}>Mode</Text>
              <Text style={styles.settingsValue}>Classic</Text>
            </View>
          </Card>
        )}

        {/* Add Bot */}
        {isHost && roomInfo.phase === 'lobby' && (
          <View style={styles.botSection}>
            {showBotPicker ? (
              <Card style={styles.botPicker}>
                <Text style={styles.sectionTitle}>Add Bot</Text>
                <View style={styles.botOptions}>
                  {(['easy', 'medium', 'hard', 'impossible'] as BotDifficulty[]).map((d) => {
                    const info = DIFF[d];
                    return (
                      <TouchableOpacity key={d} style={styles.botOption} onPress={() => handleAddBot(d)}>
                        <Text style={styles.botEmoji}>{info.emoji}</Text>
                        <Text style={[styles.botLabel, { color: info.color }]}>{info.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </Card>
            ) : (
              <Button title="+ Add Bot" variant="secondary" onPress={() => setShowBotPicker(true)} />
            )}
          </View>
        )}

        {/* Invite Friends */}
        {friendsStore.friends.length > 0 && (
          <Card style={styles.friendsCard}>
            <Text style={styles.sectionTitle}>Invite Friends</Text>
            {friendsStore.friends.slice(0, 5).map((friend) => (
              <View key={friend.userId} style={styles.inviteRow}>
                <View style={styles.friendRow}>
                  <AvatarBubble avatarId={friend.avatarId} avatarColor={friend.avatarColor} size={36} />
                  <Text style={styles.friendName}>{friend.displayName}</Text>
                </View>
                <Button
                  title="Invite"
                  variant="secondary"
                  size="small"
                  onPress={() => handleInviteFriend(friend.userId)}
                />
              </View>
            ))}
          </Card>
        )}

        <View style={styles.spacer} />

        {/* Actions */}
        <ButtonRow style={styles.actions}>
          <Button
            title={myPlayer?.ready ? "I'm Ready ✓" : 'Ready Up'}
            variant={myPlayer?.ready ? 'secondary' : 'primary'}
            onPress={handleReady}
          />
          {isHost && (
            <Button
              title="Start Game"
              onPress={handleStart}
              disabled={!canStart}
            />
          )}
        </ButtonRow>
      </ScrollView>
    </Background>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.huge },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: colors.textSecondary, fontSize: fontSize.base },
  codeCard: { padding: spacing.xl, alignItems: 'center', marginBottom: spacing.md },
  codeLabel: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.medium as any },
  codeValue: { color: colors.text, fontSize: fontSize.huge, fontWeight: fontWeight.bold as any, letterSpacing: 4, marginVertical: spacing.sm },
  codeHint: { color: colors.textTertiary, fontSize: fontSize.xs },
  shareIcon: { fontSize: 20 },
  teamCard: { padding: spacing.md, marginBottom: spacing.md },
  teamHeader: { borderLeftWidth: 3, paddingLeft: spacing.md, marginBottom: spacing.md },
  teamTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.semibold as any },
  teamCount: { color: colors.textTertiary, fontSize: fontSize.sm },
  playerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  playerInfo: { flex: 1, marginLeft: spacing.sm },
  playerName: { color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.medium as any },
  playerBotLabel: { color: colors.textTertiary, fontSize: fontSize.xs },
  playerStatus: { marginRight: spacing.sm },
  readyBadge: { color: colors.success, fontSize: fontSize.sm, fontWeight: fontWeight.semibold as any },
  notReadyBadge: { color: colors.textTertiary, fontSize: fontSize.sm },
  kickButton: { color: colors.textTertiary, fontSize: 16 },
  emptyTeamText: { color: colors.textTertiary, fontSize: fontSize.sm, textAlign: 'center', paddingVertical: spacing.md },
  settingsCard: { padding: spacing.lg, marginBottom: spacing.md },
  sectionTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.semibold as any, marginBottom: spacing.md },
  settingsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
  settingsLabel: { color: colors.textSecondary, fontSize: fontSize.base },
  settingsValue: { color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.medium as any },
  botSection: { marginBottom: spacing.md },
  botPicker: { padding: spacing.lg },
  botOptions: { flexDirection: 'row', justifyContent: 'space-around' },
  botOption: { alignItems: 'center', padding: spacing.md },
  botEmoji: { fontSize: 28, marginBottom: spacing.xs },
  botLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold as any },
  friendsCard: { padding: spacing.lg, marginBottom: spacing.md },
  inviteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm },
  friendRow: { flexDirection: 'row', alignItems: 'center' },
  friendName: { color: colors.text, fontSize: fontSize.base, marginLeft: spacing.sm },
  spacer: { height: spacing.xl },
  actions: { paddingBottom: spacing.xl },
});