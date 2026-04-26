import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, type ViewStyle } from 'react-native';
import { colors, spacing, fontSize, fontWeight } from '@/theme';

interface FilterChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  style?: ViewStyle;
}

export function FilterChip({ label, selected, onPress, style }: FilterChipProps) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected, style]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

interface ConnectionOverlayProps {
  status: 'connecting' | 'recovering' | 'offline' | 'error';
  message?: string;
  onRetry?: () => void;
  onBack?: () => void;
}

export function ConnectionOverlay({ status, message, onRetry, onBack }: ConnectionOverlayProps) {
  const statusMessages: Record<string, string> = {
    connecting: 'Connecting...',
    recovering: 'Reconnecting...',
    offline: 'Connection lost',
    error: message ?? 'Something went wrong',
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.overlayCard}>
        <View style={styles.spinner} />
        <Text style={styles.overlayTitle}>{statusMessages[status]}</Text>
        {message && <Text style={styles.overlayMessage}>{message}</Text>}
        <View style={styles.overlayButtons}>
          {onRetry && (
            <TouchableOpacity style={styles.overlayButton} onPress={onRetry}>
              <Text style={styles.overlayButtonText}>Retry</Text>
            </TouchableOpacity>
          )}
          {onBack && (
            <TouchableOpacity style={[styles.overlayButton, styles.overlayButtonSecondary]} onPress={onBack}>
              <Text style={styles.overlayButtonTextSecondary}>Leave</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

// Game history row
interface GameHistoryRowProps {
  won: boolean;
  gameVariant: string;
  botDifficulty: string | null;
  myTeamColor: string;
  playerCount: number;
  durationMs: number;
  endedAt: number;
  style?: ViewStyle;
}

export function GameHistoryRow({ won, gameVariant, botDifficulty, myTeamColor, playerCount, durationMs, endedAt, style }: GameHistoryRowProps) {
  const teamColor = myTeamColor === 'blue' ? colors.teamBlue : myTeamColor === 'green' ? colors.teamGreen : colors.teamRed;
  const dateStr = new Date(endedAt / 1).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const durationStr = durationMs >= 60000
    ? `${Math.floor(durationMs / 60000)}m ${Math.floor((durationMs % 60000) / 1000)}s`
    : `${Math.floor(durationMs / 1000)}s`;

  return (
    <View style={[styles.historyRow, style]}>
      <View style={[styles.resultBadge, { backgroundColor: won ? colors.success + '25' : colors.error + '25' }]}>
        <Text style={[styles.resultText, { color: won ? colors.success : colors.error }]}>{won ? 'W' : 'L'}</Text>
      </View>
      <View style={styles.historyInfo}>
        <Text style={styles.historyVariant}>
          {gameVariant === 'classic' ? 'Classic' : gameVariant}
          {botDifficulty ? ` · ${botDifficulty}` : ''}
        </Text>
        <Text style={styles.historyMeta}>{playerCount} players · {durationStr}</Text>
      </View>
      <View style={[styles.teamDot, { backgroundColor: teamColor }]} />
      <Text style={styles.historyDate}>{dateStr}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // FilterChip
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  chipSelected: {
    backgroundColor: colors.primary + '25',
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium as any,
  },
  chipTextSelected: {
    color: colors.primaryLight,
    fontWeight: fontWeight.semibold as any,
  },

  // ConnectionOverlay
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  overlayCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: 20,
    padding: spacing.xl,
    width: '80%',
    maxWidth: 340,
    alignItems: 'center',
  },
  spinner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: colors.primary,
    borderTopColor: 'transparent',
    marginBottom: spacing.md,
  },
  overlayTitle: {
    color: colors.textOnDark,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold as any,
    textAlign: 'center',
  },
  overlayMessage: {
    color: colors.textOnDarkSecondary,
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  overlayButtons: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  overlayButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 12,
  },
  overlayButtonText: {
    color: '#fff',
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold as any,
  },
  overlayButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.cardBorderActive,
  },
  overlayButtonTextSecondary: {
    color: colors.textSecondary,
    fontSize: fontSize.base,
  },

  // GameHistoryRow
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    marginBottom: spacing.sm,
  },
  resultBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  resultText: {
    fontSize: 14,
    fontWeight: fontWeight.bold as any,
  },
  historyInfo: {
    flex: 1,
  },
  historyVariant: {
    color: colors.text,
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium as any,
  },
  historyMeta: {
    color: colors.textTertiary,
    fontSize: fontSize.xs,
    marginTop: spacing.xs / 2,
  },
  teamDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.sm,
  },
  historyDate: {
    color: colors.textTertiary,
    fontSize: fontSize.sm,
  },
});