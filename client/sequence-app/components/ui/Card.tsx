import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { colors, radius, spacing } from '@/theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: keyof typeof spacing;
  onPress?: () => void;
  active?: boolean;
}

export function Card({ children, style, padding = 'base', onPress, active }: CardProps) {
  const Container = onPress ? View : View;
  return (
    <Container
      style={[
        styles.card,
        { padding: spacing[padding] },
        active && styles.cardActive,
        style,
      ]}
      onTouchEnd={onPress}
    >
      {children}
    </Container>
  );
}

export function CardSection({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.section, style]}>{children}</View>;
}

export function CardDivider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
  },
  cardActive: {
    borderColor: colors.cardBorderActive,
    backgroundColor: colors.cardBgHover,
  },
  section: {
    padding: spacing.base,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
    marginHorizontal: spacing.base,
  },
});