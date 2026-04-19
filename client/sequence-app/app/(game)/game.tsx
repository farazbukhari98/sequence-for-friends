import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity, FlatList } from 'react-native';
import { useGameStore } from '@/stores/gameStore';
import { useAuthStore } from '@/stores/authStore';
import { Background } from '@/components/ui/Background';
import { HeaderBar } from '@/components/ui/HeaderBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { AvatarBubble } from '@/components/ui/Avatar';
import { Toast } from '@/components/ui/Toast';
import { ConnectionOverlay } from '@/components/ui/Shared';
import { colors, spacing, fontSize, fontWeight, radius } from '@/theme';
import { BOARD_LAYOUT, getJackType, isCorner, CORNER_POSITIONS, TEAM_COLORS, DIFFICULTY_INFO as DIFF } from '@/constants/board';
import { getCardDisplay, getCardFullName } from '@/types/game';
import type { TeamColor, PublicPlayer, ClientGameState, CardCode, GameAction } from '@/types/game';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BOARD_CELL_SIZE = Math.floor((SCREEN_WIDTH - 24) / 10);
const CARD_HEIGHT = 56;
const CARD_WIDTH = 38;

// Card component for hand
function HandCard({ card, selected, playable, onPress }: { card: string; selected: boolean; playable: boolean; onPress: () => void }) {
  const display = getCardDisplay(card);
  const jackType = getJackType(card);

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!playable && !selected}
      style={[
        styles.handCard,
        selected && styles.handCardSelected,
        !playable && !selected && styles.handCardDisabled,
        jackType === 'two-eyed' && styles.handCardTwoEyedJack,
        jackType === 'one-eyed' && styles.handCardOneEyedJack,
      ]}
    >
      <Text style={[styles.cardRank, { color: display.suitColorHex }]}>{display.rank}</Text>
      <Text style={[styles.cardSuit, { color: display.suitColorHex }]}>{display.suit}</Text>
      {jackType && (
        <Text style={styles.jackLabel}>
          {jackType === 'two-eyed' ? 'WILD' : 'REMOVE'}
        </Text>
      )}
    </TouchableOpacity>
  );
}

// Board cell component
function BoardCell({
  cellValue,
  chip,
  isHighlighted,
  isCorner,
  isLocked,
  cellRow,
  cellCol,
  onPress,
}: {
  cellValue: string;
  chip: number | null;
  isHighlighted: boolean;
  isCorner: boolean;
  isLocked: boolean;
  cellRow: number;
  cellCol: number;
  onPress: (row: number, col: number) => void;
}) {
  const display = getCardDisplay(cellValue);
  const teamColor = chip !== null ? (['blue', 'green', 'red'] as TeamColor[])[chip] : null;
  const teamHex = teamColor ? TEAM_COLORS[teamColor]?.hex ?? colors.primary : colors.primary;

  return (
    <TouchableOpacity
      onPress={() => onPress(cellRow, cellCol)}
      style={[
        styles.boardCell,
        isCorner && styles.boardCornerCell,
        isHighlighted && styles.boardCellHighlighted,
        chip !== null && styles.boardCellWithChip,
        isLocked && styles.boardCellLocked,
      ]}
    >
      {/* Card label */}
      <Text style={[
        styles.boardCellText,
        isCorner && styles.boardCornerText,
        { color: display.suitColorHex },
        chip !== null && styles.boardCellTextWithChip,
      ]}>
        {isCorner ? '★' : display.rank || display.suit}
      </Text>
      {/* Chip overlay */}
      {chip !== null && (
        <View style={[styles.chipOverlay, { backgroundColor: teamHex + '40', borderColor: teamHex }]}>
          <Text style={[styles.chipText, { color: teamHex }]}>
            {TEAM_COLORS[teamColor!]?.letter}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function GameScreen() {
  const { gameState, roomInfo, selectedCard, highlightedCells, celebrationState, winnerInfo, connectionStatus, selectCard, setHighlightedCells, sendGameAction, leaveRoom } = useGameStore();
  const { user } = useAuthStore();
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const router = require('expo-router').useRouter();

  if (!gameState) {
    return (
      <Background style={styles.container}>
        <ConnectionOverlay status="connecting" />
      </Background>
    );
  }

  const myPlayer = gameState.players.find(p => p.id === gameState.myPlayerId);
  const isMyTurn = gameState.players[gameState.currentPlayerIndex]?.id === gameState.myPlayerId;
  const currentTeam = gameState.players[gameState.currentPlayerIndex]?.teamColor;

  // Handle board cell tap
  const handleCellPress = useCallback((row: number, col: number) => {
    if (!isMyTurn || !selectedCard) return;
    const action: GameAction = {
      type: 'place',
      card: selectedCard,
      targetRow: row,
      targetCol: col,
    };
    sendGameAction(action);
    selectCard(null);
    setHighlightedCells(new Set());
  }, [isMyTurn, selectedCard, gameState.myPlayerId]);

  // Handle card selection in hand
  const handleCardPress = useCallback((card: string) => {
    if (!isMyTurn) return;
    if (selectedCard === card) {
      selectCard(null);
      setHighlightedCells(new Set());
      return;
    }
    selectCard(card);

    // Calculate highlighted cells
    const cells = new Set<string>();
    const jackType = getJackType(card);

    if (jackType === 'two-eyed') {
      // Two-eyed Jack: can place on any empty cell
      for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 10; c++) {
          if (isCorner(r, c)) continue;
          if (gameState.boardChips[r][c] !== null) continue;
          cells.add(`${r},${c}`);
        }
      }
    } else if (jackType === 'one-eyed') {
      // One-eyed Jack: can remove opponent's chips
      const myTeam = myPlayer?.teamIndex ?? -1;
      for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 10; c++) {
          if (isCorner(r, c)) continue;
          const chip = gameState.boardChips[r][c];
          if (chip === null) continue;
          if (chip === myTeam) continue;
          cells.add(`${r},${c}`);
        }
      }
    } else {
      // Regular card: show available positions on board
      for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 10; c++) {
          if (BOARD_LAYOUT[r][c] === card && gameState.boardChips[r][c] === null) {
            cells.add(`${r},${c}`);
          }
        }
      }
    }

    setHighlightedCells(cells);
  }, [selectedCard, isMyTurn, gameState, myPlayer]);

  // Determine which cards are "playable" (have at least one valid position)
  const playableCards = useMemo(() => {
    if (!isMyTurn) return new Set<string>();
    const playable = new Set<string>();
    for (const card of gameState.myHand) {
      const jackType = getJackType(card);
      if (jackType === 'two-eyed') {
        // Check if there's any empty cell
        for (let r = 0; r < 10; r++) {
          for (let c = 0; c < 10; c++) {
            if (!isCorner(r, c) && gameState.boardChips[r][c] === null) {
              playable.add(card);
              break;
            }
          }
          if (playable.has(card)) break;
        }
      } else if (jackType === 'one-eyed') {
        // Check if there's an opponent chip to remove
        const myTeam = myPlayer?.teamIndex ?? -1;
        for (let r = 0; r < 10; r++) {
          for (let c = 0; c < 10; c++) {
            if (!isCorner(r, c) && gameState.boardChips[r][c] !== null && gameState.boardChips[r][c] !== myTeam) {
              playable.add(card);
              break;
            }
          }
          if (playable.has(card)) break;
        }
      } else {
        // Regular card: check if at least one position is empty
        for (let r = 0; r < 10; r++) {
          for (let c = 0; c < 10; c++) {
            if (BOARD_LAYOUT[r][c] === card && gameState.boardChips[r][c] === null) {
              playable.add(card);
              break;
            }
          }
          if (playable.has(card)) break;
        }
      }
    }
    return playable;
  }, [gameState.myHand, gameState.boardChips, isMyTurn, myPlayer]);

  // Handle dead card replacement
  const handleDeadCard = (card: string) => {
    selectCard(null);
    setHighlightedCells(new Set());
    sendGameAction({ type: 'replace-dead-card', card });
  };

  const currentPlayerName = gameState.players[gameState.currentPlayerIndex]?.name ?? 'Unknown';

  // Watch for game end
  React.useEffect(() => {
    if (gameState.winnerTeamIndex !== null && gameState.winnerTeamIndex !== undefined) {
      // Navigate to results
      setTimeout(() => router.push('/(game)/results'), 1500);
    }
  }, [gameState.winnerTeamIndex]);

  return (
    <Background style={styles.container}>
      {/* Header: Turn indicator */}
      <View style={[styles.turnBanner, { backgroundColor: (TEAM_COLORS[currentTeam!]?.hex ?? colors.primary) + '25' }]}>
        <Text style={styles.turnText}>
          {isMyTurn ? '🎯 Your turn!' : `⏳ ${currentPlayerName}'s turn`}
        </Text>
        {gameState.turnTimeLimit > 0 && (
          <Text style={styles.turnTimer}>{gameState.turnTimeLimit}s</Text>
        )}
      </View>

      {/* Score bar */}
      <View style={styles.scoreBar}>
        {gameState.config.teamColors.map((tc, i) => (
          <View key={tc} style={styles.scoreItem}>
            <View style={[styles.scoreDot, { backgroundColor: TEAM_COLORS[tc]?.hex }]} />
            <Text style={styles.scoreText}>
              {gameState.teamScores[i] ?? 0} pts · {gameState.sequencesCompleted[i] ?? 0} seq
            </Text>
          </View>
        ))}
        <View style={styles.deckInfo}>
          <Text style={styles.deckText}>🂠 {gameState.deckCount}</Text>
        </View>
      </View>

      {/* Board */}
      <ScrollView horizontal={false} contentContainerStyle={styles.boardContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.board}>
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
                    isCorner={isCorner(rowIdx, colIdx)}
                    isLocked={gameState.lockedCells?.[rowIdx]?.[colIdx] === 'true'}
                    cellRow={rowIdx}
                    cellCol={colIdx}
                    onPress={handleCellPress}
                  />
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Celebration overlay */}
      {celebrationState && (
        <View style={[styles.celebrationOverlay, { backgroundColor: (TEAM_COLORS[celebrationState.teamColor as TeamColor]?.hex ?? colors.primary) + '15' }]}>
          <Text style={styles.celebrationText}>
            🎉 Sequence! +{celebrationState.pointsAwarded} pts
          </Text>
        </View>
      )}

      {/* Hand */}
      <View style={styles.handContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.handScroll}>
          {gameState.myHand.map((card, index) => {
            const playable = playableCards.has(card);
            return (
              <HandCard
                key={`${card}-${index}`}
                card={card}
                selected={selectedCard === card}
                playable={playable}
                onPress={() => handleCardPress(card)}
              />
            );
          })}
        </ScrollView>
        {selectedCard && (
          <Text style={styles.selectedCardLabel}>
            {getCardFullName(selectedCard)} {getJackType(selectedCard) ? `(${getJackType(selectedCard) === 'two-eyed' ? 'Wild' : 'Remove'})` : ''}
          </Text>
        )}
        {!isMyTurn && (
          <Text style={styles.waitingText}>Waiting for {currentPlayerName}...</Text>
        )}
      </View>

      {/* Toast for errors */}
      <Toast message={errorMessage} type="error" onDismiss={() => setErrorMessage(null)} />
    </Background>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  turnBanner: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  turnText: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold as any,
  },
  turnTimer: {
    color: colors.warning,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold as any,
  },
  scoreBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.cardBg,
  },
  scoreItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  scoreDot: { width: 10, height: 10, borderRadius: 5 },
  scoreText: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.medium as any },
  deckInfo: { alignItems: 'center' },
  deckText: { color: colors.textTertiary, fontSize: fontSize.sm },
  boardContainer: { padding: spacing.sm, alignItems: 'center' },
  board: { width: BOARD_CELL_SIZE * 10 + 2 },
  boardRow: { flexDirection: 'row' },
  boardCell: {
    width: BOARD_CELL_SIZE,
    height: BOARD_CELL_SIZE,
    borderWidth: 0.5,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgTertiary,
    position: 'relative',
  },
  boardCornerCell: {
    backgroundColor: colors.primary + '15',
  },
  boardCellHighlighted: {
    backgroundColor: colors.primary + '40',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  boardCellWithChip: {
    backgroundColor: colors.cardBg,
  },
  boardCellLocked: {
    opacity: 0.7,
  },
  boardCellText: {
    fontSize: 8,
    fontWeight: fontWeight.medium as any,
    color: colors.textTertiary,
  },
  boardCornerText: {
    fontSize: 12,
    color: '#facc15',
  },
  boardCellTextWithChip: {
    color: colors.textDisabled,
    fontSize: 7,
  },
  chipOverlay: {
    position: 'absolute',
    width: BOARD_CELL_SIZE * 0.7,
    height: BOARD_CELL_SIZE * 0.7,
    borderRadius: (BOARD_CELL_SIZE * 0.7) / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 14,
    fontWeight: fontWeight.bold as any,
  },
  handContainer: {
    backgroundColor: colors.bgSecondary,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    minHeight: CARD_HEIGHT + 44,
  },
  handScroll: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  handCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: radius.sm,
    backgroundColor: colors.cardBg,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  handCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '20',
    transform: [{ translateY: -8 }],
  },
  handCardDisabled: {
    opacity: 0.4,
  },
  handCardTwoEyedJack: {
    borderColor: colors.success,
  },
  handCardOneEyedJack: {
    borderColor: colors.error,
  },
  cardRank: {
    fontSize: 14,
    fontWeight: fontWeight.bold as any,
  },
  cardSuit: {
    fontSize: 12,
    marginTop: -2,
  },
  jackLabel: {
    fontSize: 7,
    color: colors.textTertiary,
    fontWeight: fontWeight.medium as any,
    marginTop: 1,
  },
  selectedCardLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  waitingText: {
    color: colors.textTertiary,
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  celebrationOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  celebrationText: {
    color: colors.text,
    fontSize: fontSize.huge,
    fontWeight: fontWeight.bold as any,
  },
});