import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, type ViewStyle } from 'react-native';
import { colors, spacing, fontSize, fontWeight, radius } from '@/theme';

interface HeaderBarProps {
  title: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  style?: ViewStyle;
}

export function HeaderBar({ title, onBack, rightAction, style }: HeaderBarProps) {
  return (
    <View style={[styles.header, style]}>
      {onBack && (
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
      )}
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      {rightAction ? <View style={styles.rightAction}>{rightAction}</View> : <View style={styles.rightSpacer} />}
    </View>
  );
}

interface SheetHeaderProps {
  title: string;
  onClose?: () => void;
  style?: ViewStyle;
}

export function SheetHeader({ title, onClose, style }: SheetHeaderProps) {
  return (
    <View style={[styles.sheetHeader, style]}>
      <Text style={styles.sheetTitle}>{title}</Text>
      {onClose && (
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeIcon}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    minHeight: 56,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    color: colors.text,
    fontSize: 28,
    fontWeight: fontWeight.bold as any,
    marginTop: -2,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold as any,
  },
  rightAction: {
    width: 36,
    alignItems: 'center',
  },
  rightSpacer: {
    width: 36,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
  },
  sheetTitle: {
    flex: 1,
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold as any,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    color: colors.textSecondary,
    fontSize: 16,
  },
});