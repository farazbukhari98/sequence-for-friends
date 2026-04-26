import React, { useCallback, useMemo } from 'react';
import { Alert, Animated, View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGameStore } from '@/stores/gameStore';
import { useAuthStore } from '@/stores/authStore';
import { Background } from '@/components/ui/Background';
import { Button } from '@/components/ui/Button';
import { ConnectionOverlay } from '@/components/ui/Shared';
import { Toast } from '@/components/ui/Toast';
import { SurfaceTexture } from '@/components/ui/GameTexture';
import { hapticLight, hapticSelection, hapticWarning } from '@/lib/haptics';
import { colors, spacing, fontSize, fontWeight, radius, shadows } from '@/theme';
import { BOARD_LAYOUT, getHighlightedCells, getJackType, isCorner, isDeadCard, TEAM_COLORS } from '@/constants/board';
import { getCardDisplay, getCardFullName } from '@/types/game';
import type { CardCode, ClientGameState, ConnectionStatus, EmoteType, GameAction, QuickMessageType, RoomInfo, TeamColor } from '@/types/game';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BOARD_CONTAINER_PADDING = 12;
const BOARD_CELL_SIZE = Math.floor((SCREEN_WIDTH - BOARD_CONTAINER_PADDING * 2 - 8) / 10);
const CARD_HEIGHT = 64;
const CARD_WIDTH = 46;
const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

type CelebrationState = {
  teamIndex: number;
  teamColor: string;
  sequences: number;
  pointsAwarded: number;
  totalScore: number;
} | null;

type AppRouter = ReturnType<typeof useRouter>;

function TurnEdgeFlow({ active, color }: { active: boolean; color: string }) {
  const progress = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (!active) {
      progress.stopAnimation();
      progress.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 2200,
        useNativeDriver: true,
      }),
    );

    loop.start();
    return () => loop.stop();
  }, [active, progress]);

  if (!active) return null;

  const pulseOpacity = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.1, 0.32, 0.1],
  });
  const topSweep = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-SCREEN_WIDTH * 0.55, SCREEN_WIDTH * 1.05],
  });
  const bottomSweep = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [SCREEN_WIDTH * 1.05, -SCREEN_WIDTH * 0.55],
  });

  return (
    <View pointerEvents="none" style={styles.turnEdgeFlow}>
      <Animated.View style={[styles.turnEdgeTop, { backgroundColor: color, opacity: pulseOpacity }]} />
      <Animated.View style={[styles.turnEdgeBottom, { backgroundColor: color, opacity: pulseOpacity }]} />
      <Animated.View style={[styles.turnEdgeLeft, { backgroundColor: color, opacity: pulseOpacity }]} />
      <Animated.View style={[styles.turnEdgeRight, { backgroundColor: color, opacity: pulseOpacity }]} />
      <Animated.View
        style={[
          styles.turnEdgeSweep,
          styles.turnEdgeSweepTop,
          { backgroundColor: color, transform: [{ translateX: topSweep }] },
        ]}
      />
      <Animated.View
        style={[
          styles.turnEdgeSweep,
          styles.turnEdgeSweepBottom,
          { backgroundColor: color, transform: [{ translateX: bottomSweep }] },
        ]}
      />
    </View>
  );
}

function HandCard({
  card,
  selected,
  playable,
  dead,
  onPress,
}: {
  card: CardCode;
  selected: boolean;
  playable: boolean;
  dead: boolean;
  onPress: () => void;
}) {
  const pressProgress = React.useRef(new Animated.Value(0)).current;
  const display = getCardDisplay(card);
  const jackType = getJackType(card);
  const disabled = !playable && !selected && !dead;
  const isRed = display.suit === '♥' || display.suit === '♦';
  const suitColor = isRed ? '#CC0000' : '#1C1914';
  const lift = selected ? -12 : 0;
  const animatedCardStyle = {
    transform: [
      { translateY: pressProgress.interpolate({ inputRange: [0, 1], outputRange: [lift, lift + 2] }) },
      { scale: pressProgress.interpolate({ inputRange: [0, 1], outputRange: [selected ? 1.04 : 1, selected ? 1.01 : 0.97] }) },
    ],
  };

  const animatePress = (toValue: number) => {
    Animated.spring(pressProgress, {
      toValue,
      useNativeDriver: true,
      speed: 30,
      bounciness: 4,
    }).start();
  };

  return (
    <AnimatedTouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.9}
      style={[
        styles.handCard,
        selected && styles.handCardSelected,
        disabled && styles.handCardDisabled,
        dead && !selected && styles.handCardDead,
        jackType === 'two-eyed' && styles.handCardTwoEyedJack,
        jackType === 'one-eyed' && styles.handCardOneEyedJack,
        animatedCardStyle,
      ]}
      onPressIn={() => animatePress(1)}
      onPressOut={() => animatePress(0)}
    >
      <SurfaceTexture variant="card" intensity="subtle" style={styles.handCardTexture} />
      <Text style={[styles.cardRank, { color: suitColor }]}>{display.rank}</Text>
      <Text style={[styles.cardSuit, { color: suitColor }]}>{display.suit}</Text>
      {jackType && (
        <Text style={[styles.jackLabel, { color: suitColor }]}>
          {jackType === 'two-eyed' ? 'WILD' : 'REMOVE'}
        </Text>
      )}
    </AnimatedTouchableOpacity>
  );
}

function BoardCell({
  cellValue,
  chip,
  isHighlighted,
  isCornerCell,
  isLocked,
  cellRow,
  cellCol,
  onPress,
}: {
  cellValue: string;
  chip: number | null;
  isHighlighted: boolean;
  isCornerCell: boolean;
  isLocked: boolean;
  cellRow: number;
  cellCol: number;
  onPress: (row: number, col: number) => void;
}) {
  const display = getCardDisplay(cellValue);
  const teamColor = chip !== null ? (['blue', 'green', 'red'] as TeamColor[])[chip] : null;

  // Use vivid team colors for poker chips
  let teamHex: string = colors.primary;
  if (teamColor === 'blue') teamHex = colors.teamBlue;
  if (teamColor === 'green') teamHex = colors.teamGreen;
  if (teamColor === 'red') teamHex = colors.teamRed;

  const isRed = display.suit === '♥' || display.suit === '♦';
  const suitColor = isRed ? '#CC0000' : '#1C1914';

  return (
    <TouchableOpacity
      onPress={() => onPress(cellRow, cellCol)}
      activeOpacity={0.7}
      style={[
        styles.boardCell,
        isCornerCell && styles.boardCornerCell,
        isHighlighted && styles.boardCellHighlighted,
        isLocked && styles.boardCellLocked,
      ]}
    >
      <SurfaceTexture variant={isCornerCell ? 'wood' : 'card'} intensity="subtle" style={styles.boardCellTexture} />
      <Text
        style={[
          styles.boardCellText,
          isCornerCell && styles.boardCornerText,
          { color: isCornerCell ? '#D4AF37' : suitColor },
        ]}
      >
        {isCornerCell ? '★' : display.rank || display.suit}
      </Text>
      {!isCornerCell && (
        <Text style={[styles.boardCellSuit, { color: suitColor }]}>
          {display.suit}
        </Text>
      )}
      {chip !== null && (
        <View
          style={[
            styles.chipOuter,
            { backgroundColor: teamHex },
            isLocked ? styles.chipOuterSequence : styles.chipOuterTranslucent,
          ]}
        >
          <View pointerEvents="none" style={styles.chipShine} />
          <View style={styles.chipInner}>
            <View style={[styles.chipCenter, { backgroundColor: teamHex }]}>
              <Text style={styles.chipText}>
                {TEAM_COLORS[teamColor!]?.letter}
              </Text>
            </View>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

function buildPlayAction(card: CardCode, row: number, col: number): GameAction {
  const jackType = getJackType(card);

  if (jackType === 'two-eyed') {
    return { type: 'play-two-eyed', card, targetRow: row, targetCol: col };
  }

  if (jackType === 'one-eyed') {
    return { type: 'play-one-eyed', card, targetRow: row, targetCol: col };
  }

  return { type: 'play-normal', card, targetRow: row, targetCol: col };
}

function getCardTargets(gameState: ClientGameState, card: CardCode): Set<string> {
  return getHighlightedCells(
    card,
    {
      boardChips: gameState.boardChips,
      lastRemovedCell: gameState.lastRemovedCell,
      lockedCells: gameState.lockedCells,
      players: gameState.players.map(({ id, teamIndex }) => ({ id, teamIndex })),
      currentPlayerIndex: gameState.currentPlayerIndex,
    },
    gameState.myPlayerId,
  );
}

export default function GameScreen() {
  const router = useRouter();
  const {
    roomInfo,
    playerId,
    gameState,
    selectedCard,
    highlightedCells,
    celebrationState,
    latestNotice,
    connectionStatus,
    wsConnected,
    selectCard,
    setHighlightedCells,
    sendGameAction,
    sendEmote,
    sendQuickMessage,
    clearLatestNotice,
    reconnectToRoom,
    leaveRoom,
  } = useGameStore();
  const { sessionToken } = useAuthStore();

  if (!gameState) {
    return (
      <Background style={styles.container}>
        <ConnectionOverlay status="connecting" />
      </Background>
    );
  }

  return (
    <ActiveGameScreen
      gameState={gameState}
      roomInfo={roomInfo}
      playerId={playerId}
      selectedCard={selectedCard as CardCode | null}
      highlightedCells={highlightedCells}
      celebrationState={celebrationState}
      latestNotice={latestNotice}
      connectionStatus={connectionStatus}
      wsConnected={wsConnected}
      selectCard={selectCard}
      setHighlightedCells={setHighlightedCells}
      sendGameAction={sendGameAction}
      sendEmote={sendEmote}
      sendQuickMessage={sendQuickMessage}
      clearLatestNotice={clearLatestNotice}
      reconnectToRoom={() => reconnectToRoom(sessionToken)}
      leaveRoom={leaveRoom}
      router={router}
    />
  );
}

function ActiveGameScreen({
  gameState,
  roomInfo,
  playerId,
  selectedCard,
  highlightedCells,
  celebrationState,
  latestNotice,
  connectionStatus,
  wsConnected,
  selectCard,
  setHighlightedCells,
  sendGameAction,
  sendEmote,
  sendQuickMessage,
  clearLatestNotice,
  reconnectToRoom,
  leaveRoom,
  router,
}: {
  gameState: ClientGameState;
  roomInfo: RoomInfo | null;
  playerId: string | null;
  selectedCard: CardCode | null;
  highlightedCells: Set<string>;
  celebrationState: CelebrationState;
  latestNotice: { message: string; type: 'success' | 'warning' | 'error' } | null;
  connectionStatus: ConnectionStatus;
  wsConnected: boolean;
  selectCard: (card: CardCode | null) => void;
  setHighlightedCells: (cells: Set<string>) => void;
  sendGameAction: (action: GameAction) => Promise<void>;
  sendEmote: (emote: EmoteType) => void;
  sendQuickMessage: (message: QuickMessageType) => void;
  clearLatestNotice: () => void;
  reconnectToRoom: () => Promise<void>;
  leaveRoom: (intent?: 'leave' | 'end') => void;
  router: AppRouter;
}) {
  const insets = useSafeAreaInsets();
  const topSafePadding = (insets.top > 0 ? insets.top : spacing.huge) + spacing.sm;
  const bottomSafePadding = insets.bottom > 0 ? insets.bottom : spacing.sm;
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = React.useState<number>(gameState.turnTimeLimit);
  const isMyTurn = gameState.players[gameState.currentPlayerIndex]?.id === gameState.myPlayerId;
  const isMyPendingDraw = isMyTurn && gameState.pendingDraw;
  const currentTeam = gameState.players[gameState.currentPlayerIndex]?.teamColor;
  const currentPlayerName = gameState.players[gameState.currentPlayerIndex]?.name ?? 'Unknown';
  const wasMyTurnRef = React.useRef<boolean | null>(null);
  const isHost = roomInfo?.hostId === playerId;
  const isConnectionInterrupted = connectionStatus.phase === 'offline' ||
    connectionStatus.phase === 'recovering' ||
    connectionStatus.phase === 'terminalFailure';
  const isGameConnected = wsConnected && !isConnectionInterrupted;

  const lockedCellKeys = useMemo(() => new Set(gameState.lockedCells.flat()), [gameState.lockedCells]);
  const deadCards = useMemo(() => {
    if (gameState.pendingDraw) {
      return new Set<CardCode>();
    }

    return new Set<CardCode>(gameState.myHand.filter((card) => isDeadCard(card, gameState.boardChips)));
  }, [gameState.boardChips, gameState.myHand, gameState.pendingDraw]);
  const selectedCardIsDead = selectedCard ? deadCards.has(selectedCard) : false;

  React.useEffect(() => {
    if (!gameState.turnTimeLimit || !gameState.turnStartedAt) {
      setRemainingSeconds(gameState.turnTimeLimit);
      return;
    }

    const updateRemaining = () => {
      const elapsed = Math.floor((Date.now() - gameState.turnStartedAt!) / 1000);
      setRemainingSeconds(Math.max(0, gameState.turnTimeLimit - elapsed));
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);
    return () => clearInterval(interval);
  }, [gameState.turnStartedAt, gameState.turnTimeLimit]);

  React.useEffect(() => {
    if (isMyTurn && wasMyTurnRef.current !== true) {
      hapticLight();
    }
    wasMyTurnRef.current = isMyTurn;
  }, [isMyTurn]);

  const handleCellPress = useCallback(async (row: number, col: number) => {
    if (!isGameConnected || !isMyTurn || !selectedCard || gameState.pendingDraw) return;

    try {
      await sendGameAction(buildPlayAction(selectedCard, row, col));
      hapticLight();
      selectCard(null);
      setHighlightedCells(new Set());
    } catch (error: any) {
      setActionError(error.message ?? 'Move failed');
    }
  }, [gameState.pendingDraw, isGameConnected, isMyTurn, selectCard, selectedCard, sendGameAction, setHighlightedCells]);

  const handleCardPress = useCallback((card: CardCode) => {
    if (!isGameConnected || !isMyTurn || gameState.pendingDraw) return;

    hapticSelection();

    if (selectedCard === card) {
      selectCard(null);
      setHighlightedCells(new Set());
      return;
    }

    selectCard(card);
    setHighlightedCells(getCardTargets(gameState, card));
  }, [gameState, isGameConnected, isMyTurn, selectCard, selectedCard, setHighlightedCells]);

  const playableCards = useMemo(() => {
    if (!isGameConnected || !isMyTurn || gameState.pendingDraw) {
      return new Set<CardCode>();
    }

    const playable = new Set<CardCode>();
    for (const card of gameState.myHand) {
      if (getCardTargets(gameState, card).size > 0) {
        playable.add(card);
      }
    }
    return playable;
  }, [gameState, isGameConnected, isMyTurn]);

  const handleDeadCard = useCallback(async () => {
    if (!isGameConnected || !selectedCard || !selectedCardIsDead || !isMyTurn || gameState.pendingDraw || gameState.deadCardReplacedThisTurn) {
      return;
    }

    try {
      await sendGameAction({ type: 'replace-dead', card: selectedCard });
      hapticLight();
      selectCard(null);
      setHighlightedCells(new Set());
    } catch (error: any) {
      setActionError(error.message ?? 'Could not replace dead card');
    }
  }, [
    gameState.deadCardReplacedThisTurn,
    gameState.pendingDraw,
    isGameConnected,
    isMyTurn,
    selectCard,
    selectedCard,
    selectedCardIsDead,
    sendGameAction,
    setHighlightedCells,
  ]);

  const handleDrawCard = useCallback(async () => {
    if (!isGameConnected || !isMyTurn || !gameState.pendingDraw) return;

    try {
      await sendGameAction({ type: 'draw' });
      hapticLight();
      selectCard(null);
      setHighlightedCells(new Set());
    } catch (error: any) {
      setActionError(error.message ?? 'Could not draw card');
    }
  }, [gameState.pendingDraw, isGameConnected, isMyTurn, selectCard, sendGameAction, setHighlightedCells]);

  const leaveAndRouteHome = useCallback((intent: 'leave' | 'end') => {
    leaveRoom(intent);
    router.replace('/(main)/home');
  }, [leaveRoom, router]);

  const handleLeavePress = useCallback(() => {
    hapticWarning();
    if (isHost) {
      Alert.alert(
        'Leave Game',
        'As host, you can leave and pass host control to another player, or end the game for everyone.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Leave and Transfer Host', onPress: () => leaveAndRouteHome('leave') },
          { text: 'End Game', style: 'destructive', onPress: () => leaveAndRouteHome('end') },
        ],
      );
      return;
    }

    Alert.alert(
      'Leave Game',
      'Are you sure you want to leave this game?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => leaveAndRouteHome('leave') },
      ],
    );
  }, [isHost, leaveAndRouteHome]);

  React.useEffect(() => {
    if (gameState.winnerTeamIndex !== null && gameState.winnerTeamIndex !== undefined) {
      const timer = setTimeout(() => router.replace('/(game)/results'), 1500);
      return () => clearTimeout(timer);
    }
  }, [gameState.winnerTeamIndex, router]);

  // Use vivid colors for current team banner
  let currentTeamHex: string = colors.primary;
  if (currentTeam === 'blue') currentTeamHex = colors.teamBlue;
  if (currentTeam === 'green') currentTeamHex = colors.teamGreen;
  if (currentTeam === 'red') currentTeamHex = colors.teamRed;

  return (
    <Background style={styles.container}>
      <TurnEdgeFlow active={isMyTurn} color={currentTeamHex} />
      <Toast message={actionError} type="error" onDismiss={() => setActionError(null)} />
      <Toast message={latestNotice?.message ?? null} type={latestNotice?.type} onDismiss={clearLatestNotice} />
      {isConnectionInterrupted && (
        <ConnectionOverlay
          status={connectionStatus.phase === 'recovering' ? 'recovering' : connectionStatus.phase === 'terminalFailure' ? 'error' : 'offline'}
          message={connectionStatus.message ?? undefined}
          onRetry={connectionStatus.canRetry ? async () => {
            await reconnectToRoom();
            hapticLight();
          } : undefined}
          onBack={() => leaveAndRouteHome('leave')}
        />
      )}

      <View style={[styles.safeContent, { paddingTop: topSafePadding }]}>
        <View style={styles.topActionRow}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Leave game"
            onPress={handleLeavePress}
            style={styles.leaveButton}
            activeOpacity={0.78}
          >
            <Ionicons name="close" size={20} color={colors.textDark} />
          </TouchableOpacity>
        </View>

        <View style={[styles.turnBanner, { borderLeftColor: currentTeamHex }]}>
          <SurfaceTexture variant="card" intensity="subtle" style={styles.cardSurfaceTexture} />
          <View style={styles.turnTextRow}>
            <Ionicons
              name={isMyTurn ? 'disc' : 'hourglass-outline'}
              size={20}
              color={isMyTurn ? colors.gold : colors.textSecondary}
            />
            <Text style={styles.turnText}>
              {isMyTurn ? 'Your turn!' : `${currentPlayerName}'s turn`}
            </Text>
          </View>
          {gameState.turnTimeLimit > 0 && (
            <Text style={styles.turnTimer}>{remainingSeconds}s</Text>
          )}
        </View>

        <View style={styles.scoreBar}>
          <SurfaceTexture variant="card" intensity="subtle" style={styles.cardSurfaceTexture} />
          {gameState.config.teamColors.map((teamColor, index) => {
            let tHex: string = colors.primary;
            if (teamColor === 'blue') tHex = colors.teamBlue;
            if (teamColor === 'green') tHex = colors.teamGreen;
            if (teamColor === 'red') tHex = colors.teamRed;

            return (
              <View key={teamColor} style={styles.scoreItem}>
                <View style={[styles.scoreDot, { backgroundColor: tHex }]} />
                <Text style={styles.scoreText}>
                  {gameState.teamScores[index] ?? 0} pts · {gameState.sequencesCompleted[index] ?? 0} seq
                </Text>
              </View>
            );
          })}
          <View style={styles.deckInfo}>
            <Ionicons name="layers-outline" size={16} color={colors.textDarkTertiary} />
            <Text style={styles.deckText}>{gameState.deckCount}</Text>
          </View>
        </View>

        <ScrollView
          style={styles.boardViewport}
          horizontal={false}
          contentContainerStyle={styles.boardScroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.boardContainer}>
            <SurfaceTexture variant="wood" intensity="medium" style={styles.panelTexture} />
            <View style={styles.board}>
              <SurfaceTexture variant="card" intensity="subtle" style={styles.cardSurfaceTexture} />
              {BOARD_LAYOUT.map((row, rowIdx) => (
                <View key={rowIdx} style={styles.boardRow}>
                  {row.map((cellValue, colIdx) => {
                    const cellKey = `${rowIdx},${colIdx}`;

                    return (
                      <BoardCell
                        key={cellKey}
                        cellValue={cellValue}
                        chip={gameState.boardChips[rowIdx]?.[colIdx] ?? null}
                        isHighlighted={highlightedCells.has(cellKey)}
                        isCornerCell={isCorner(rowIdx, colIdx)}
                        isLocked={lockedCellKeys.has(cellKey)}
                        cellRow={rowIdx}
                        cellCol={colIdx}
                        onPress={handleCellPress}
                      />
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        </ScrollView>

        {celebrationState && (
          <View style={[styles.celebrationOverlay]}>
            <View style={styles.celebrationCard}>
              <SurfaceTexture variant="card" intensity="medium" style={styles.cardSurfaceTexture} />
              <Ionicons name="sparkles" size={48} color={colors.gold} style={styles.celebrationIcon} />
              <Text style={styles.celebrationText}>
                Sequence! +{celebrationState.pointsAwarded} pts
              </Text>
            </View>
          </View>
        )}

        <View style={[styles.handContainer, { paddingBottom: bottomSafePadding + spacing.sm }]}>
          <SurfaceTexture variant="wood" intensity="medium" style={styles.panelTexture} />
          <View style={styles.tableTalkRow}>
            {(['thumbs-up', 'clap', 'fire', 'thinking'] as EmoteType[]).map((emote) => (
              <TouchableOpacity
                key={emote}
                style={[styles.tableTalkButton, !isGameConnected && styles.tableTalkButtonDisabled]}
                disabled={!isGameConnected}
                onPress={() => { hapticSelection(); sendEmote(emote); }}
              >
                <Text style={styles.tableTalkText}>{emote === 'thumbs-up' ? '👍' : emote === 'clap' ? '👏' : emote === 'fire' ? '🔥' : '…'}</Text>
              </TouchableOpacity>
            ))}
            {(['nice-move', 'good-game', 'rematch'] as QuickMessageType[]).map((message) => (
              <TouchableOpacity
                key={message}
                style={[styles.quickMessageButton, !isGameConnected && styles.tableTalkButtonDisabled]}
                disabled={!isGameConnected}
                onPress={() => { hapticSelection(); sendQuickMessage(message); }}
              >
                <Text style={styles.quickMessageText}>
                  {message === 'nice-move' ? 'Nice' : message === 'good-game' ? 'GG' : 'Rematch'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.handScroll}>
            {gameState.myHand.map((card, index) => {
              const playable = playableCards.has(card);
              const dead = deadCards.has(card);

              return (
                <HandCard
                  key={`${card}-${index}`}
                  card={card}
                  selected={selectedCard === card}
                  playable={playable}
                  dead={dead}
                  onPress={() => handleCardPress(card)}
                />
              );
            })}
          </ScrollView>

          {isMyPendingDraw ? (
            <View style={styles.turnActionPanel}>
              <Text style={styles.turnActionText}>Draw a card to end your turn.</Text>
              <Button title="Draw Card" size="medium" onPress={handleDrawCard} />
            </View>
          ) : selectedCard ? (
            <View style={styles.selectionPanel}>
              <Text style={styles.selectedCardLabel}>
                {getCardFullName(selectedCard)} {getJackType(selectedCard) ? `(${getJackType(selectedCard) === 'two-eyed' ? 'Wild' : 'Remove'})` : ''}
              </Text>
              {selectedCardIsDead && (
                <Button
                  title="Replace Dead Card"
                  variant="secondary"
                  size="small"
                  onPress={handleDeadCard}
                  style={styles.deadCardButton}
                />
              )}
            </View>
          ) : null}

          {selectedCardIsDead && !gameState.pendingDraw && (
            <Text style={styles.deadCardHint}>This card has no open positions. Replace it to keep your turn moving.</Text>
          )}

          {!isMyTurn && (
            <Text style={styles.waitingText}>Waiting for {currentPlayerName}...</Text>
          )}
        </View>
      </View>
    </Background>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  turnEdgeFlow: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  turnEdgeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  turnEdgeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  turnEdgeLeft: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 3,
  },
  turnEdgeRight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: 3,
  },
  turnEdgeSweep: {
    position: 'absolute',
    width: SCREEN_WIDTH * 0.5,
    height: 3,
    opacity: 0.6,
    borderRadius: 2,
  },
  turnEdgeSweepTop: {
    top: 0,
  },
  turnEdgeSweepBottom: {
    bottom: 0,
  },
  safeContent: {
    flex: 1,
  },
  topActionRow: {
    minHeight: 44,
    marginHorizontal: spacing.md,
    marginBottom: spacing.xs,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  leaveButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F8F1E4',
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  turnBanner: {
    marginHorizontal: spacing.md,
    marginTop: 0,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8F1E4', // Off-white placard
    borderRadius: radius.md,
    borderLeftWidth: 6, // Thick left border for team color
    position: 'relative',
    ...shadows.md,
  },
  turnTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  turnText: {
    color: colors.textDark,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold as any,
  },
  turnTimer: {
    color: colors.error, // Red for urgency
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold as any,
  },
  scoreBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#E8DCC4', // Wood-like panel
    borderRadius: radius.md,
    position: 'relative',
    ...shadows.sm,
  },
  scoreItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  scoreDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: '#fff' },
  scoreText: { color: colors.textDark, fontSize: fontSize.sm, fontWeight: fontWeight.bold as any },
  deckInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  deckText: { color: colors.textDarkSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.bold as any },

  boardViewport: {
    flex: 1,
  },
  boardScroll: { alignItems: 'center', paddingVertical: spacing.sm },
  boardContainer: {
    padding: BOARD_CONTAINER_PADDING,
    backgroundColor: colors.primaryDark, // Dark wood border
    borderRadius: radius.lg,
    ...shadows.lg,
    borderWidth: 2,
    borderColor: '#4A2511', // Very dark wood outer edge
    position: 'relative',
  },
  board: {
    width: BOARD_CELL_SIZE * 10 + 2,
    backgroundColor: '#E8DCC4', // Background between cells
    borderWidth: 2,
    borderColor: '#3E2723',
    borderRadius: 2,
    position: 'relative',
  },
  boardRow: { flexDirection: 'row' },
  boardCell: {
    width: BOARD_CELL_SIZE,
    height: BOARD_CELL_SIZE,
    borderWidth: 0.5,
    borderColor: 'rgba(62, 39, 35, 0.2)', // Subtle dividing lines
    backgroundColor: '#F8F1E4', // Card color
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  boardCornerCell: {
    backgroundColor: '#3E2723', // Dark wood or dark felt for corners
  },
  boardCellHighlighted: {
    backgroundColor: '#FFFDE7',
    borderWidth: 2,
    borderColor: colors.gold,
    zIndex: 10,
    ...shadows.glow,
  },
  boardCellLocked: {
    borderColor: colors.gold,
    backgroundColor: '#FFF8E8',
  },
  boardCellText: {
    fontSize: 10,
    fontWeight: fontWeight.bold as any,
  },
  boardCellSuit: {
    fontSize: 12,
    marginTop: -2,
  },
  boardCornerText: {
    fontSize: 14,
  },

  // 3D Poker Chip Styling
  chipOuter: {
    position: 'absolute',
    width: BOARD_CELL_SIZE * 0.8,
    height: BOARD_CELL_SIZE * 0.8,
    borderRadius: (BOARD_CELL_SIZE * 0.8) / 2,
    borderWidth: 2,
    borderColor: '#FFFFFF', // White rim of chip
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...shadows.md, // Drop shadow for 3D effect
  },
  chipOuterTranslucent: {
    opacity: 0.68,
  },
  chipOuterSequence: {
    opacity: 1,
    borderColor: colors.gold,
    borderWidth: 3,
    ...shadows.goldGlow,
  },
  chipInner: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#FFFFFF', // Dashed inner ring
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipCenter: {
    width: '60%',
    height: '60%',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 10,
    fontWeight: fontWeight.bold as any,
    color: '#FFFFFF',
  },

  handContainer: {
    backgroundColor: colors.primaryDark, // Player's wooden tray
    borderTopWidth: 4,
    borderTopColor: '#4A2511',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    minHeight: CARD_HEIGHT + 60,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    ...shadows.lg,
    position: 'relative',
  },
  tableTalkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
  },
  tableTalkButton: {
    width: 34,
    height: 30,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(248, 241, 228, 0.16)',
  },
  tableTalkButtonDisabled: {
    opacity: 0.42,
  },
  tableTalkText: {
    fontSize: 16,
  },
  quickMessageButton: {
    minHeight: 30,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    backgroundColor: 'rgba(248, 241, 228, 0.16)',
  },
  quickMessageText: {
    color: '#F8F1E4',
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold as any,
  },
  handScroll: {
    gap: spacing.sm,
    paddingVertical: spacing.md, // Room for hover state
    paddingHorizontal: spacing.sm,
  },
  handCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: radius.md,
    backgroundColor: '#FFFFFF', // Pure white for real cards
    borderWidth: 1,
    borderColor: '#CCCCCC',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    position: 'relative',
    overflow: 'hidden',
    ...shadows.md,
  },
  handCardSelected: {
    borderColor: colors.gold,
    borderWidth: 2,
    ...shadows.lg,
  },
  handCardDisabled: {
    opacity: 0.6,
    backgroundColor: '#F0F0F0',
  },
  handCardDead: {
    borderColor: colors.warning,
    backgroundColor: '#FFF9E6',
  },
  handCardTwoEyedJack: {
    borderColor: colors.success,
  },
  handCardOneEyedJack: {
    borderColor: colors.error,
  },
  cardRank: {
    fontSize: 16,
    fontWeight: fontWeight.bold as any,
  },
  cardSuit: {
    fontSize: 16,
    marginTop: -2,
  },
  jackLabel: {
    fontSize: 8,
    fontWeight: fontWeight.bold as any,
    marginTop: 2,
  },
  selectionPanel: {
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  selectedCardLabel: {
    color: '#F8F1E4',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium as any,
    textAlign: 'center',
  },
  deadCardButton: {
    alignSelf: 'center',
  },
  deadCardHint: {
    color: colors.warningLight,
    fontSize: fontSize.xs,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  turnActionPanel: {
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  turnActionText: {
    color: '#F8F1E4',
    fontSize: fontSize.sm,
    textAlign: 'center',
    fontWeight: fontWeight.bold as any,
  },
  waitingText: {
    color: 'rgba(248, 241, 228, 0.7)',
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  celebrationOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  celebrationCard: {
    backgroundColor: '#F8F1E4',
    padding: spacing.xl,
    borderRadius: radius.xl,
    alignItems: 'center',
    position: 'relative',
    ...shadows.lg,
    borderWidth: 4,
    borderColor: colors.gold,
  },
  celebrationIcon: {
    marginBottom: spacing.md,
  },
  celebrationText: {
    color: colors.textDark,
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold as any,
  },
  panelTexture: {
    opacity: 0.22,
  },
  cardSurfaceTexture: {
    opacity: 0.26,
  },
  boardCellTexture: {
    opacity: 0.18,
    borderRadius: 0,
  },
  handCardTexture: {
    opacity: 0.28,
    borderRadius: radius.md,
  },
  chipShine: {
    position: 'absolute',
    top: 2,
    left: 3,
    width: '42%',
    height: '34%',
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    opacity: 0.24,
  },
});
