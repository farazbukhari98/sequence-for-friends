import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, radius, spacing, fontSize, fontWeight } from '@/theme';

// Single stat row
export function StatValue({ value, label, color }: { value: string | number; label: string; color?: string }) {
  return (
    <View style={styles.statContainer}>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// Stat card with accent color
export function StatCard({ value, label, color, icon }: { value: string | number; label: string; color?: string; icon?: string }) {
  return (
    <View style={[styles.statCard, color ? { borderLeftColor: color } : null]}>
      {icon && <Text style={styles.statIcon}>{icon}</Text>}
      <Text style={[styles.statCardValue, color ? { color } : null]}>{value}</Text>
      <Text style={styles.statCardLabel}>{label}</Text>
    </View>
  );
}

// Stat row for profile
export function StatRow({ stats }: { stats: { value: string | number; label: string; color?: string }[] }) {
  return (
    <View style={styles.statRow}>
      {stats.map((stat, i) => (
        <View key={i} style={styles.statRowItem}>
          <Text style={[styles.statRowValue, stat.color ? { color: stat.color } : null]}>
            {stat.value}
          </Text>
          <Text style={styles.statRowLabel}>{stat.label}</Text>
        </View>
      ))}
    </View>
  );
}

// Win/Loss badge
export function ResultBadge({ won }: { won: boolean }) {
  return (
    <View style={[styles.badge, won ? styles.badgeWin : styles.badgeLoss]}>
      <Text style={styles.badgeText}>{won ? 'W' : 'L'}</Text>
    </View>
  );
}

// Team color dot
export function TeamDot({ color, size = 10 }: { color: string; size?: number }) {
  const teamColor = color === 'blue' ? colors.teamBlue : color === 'green' ? colors.teamGreen : color === 'red' ? colors.teamRed : colors.textTertiary;
  return (
    <View style={[styles.teamDot, { backgroundColor: teamColor, width: size, height: size, borderRadius: size / 2 }]} />
  );
}

const styles = StyleSheet.create({
  statContainer: {
    alignItems: 'center',
  },
  statValue: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold as any,
  },
  statLabel: {
    color: colors.textTertiary,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium as any,
    marginTop: spacing.xs / 2,
  },
  statCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.md,
    padding: spacing.base,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  statIcon: {
    fontSize: 16,
    marginBottom: spacing.xs,
  },
  statCardValue: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold as any,
  },
  statCardLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    marginTop: spacing.xs / 2,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.md,
  },
  statRowItem: {
    alignItems: 'center',
  },
  statRowValue: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold as any,
  },
  statRowLabel: {
    color: colors.textTertiary,
    fontSize: fontSize.xs,
    marginTop: spacing.xs / 2,
  },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeWin: {
    backgroundColor: colors.success + '30',
  },
  badgeLoss: {
    backgroundColor: colors.error + '30',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: fontWeight.bold as any,
  },
  teamDot: {
    backgroundColor: colors.textTertiary,
  },
});