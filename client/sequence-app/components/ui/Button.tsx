import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, type TouchableOpacityProps, type TextStyle, type ViewStyle } from 'react-native';
import { colors, radius, spacing, fontSize, fontWeight } from '@/theme';

interface ButtonProps extends Omit<TouchableOpacityProps, 'style'> {
  title: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  title,
  variant = 'primary',
  size = 'medium',
  loading = false,
  disabled = false,
  icon,
  style,
  textStyle,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      style={[
        styles.base,
        styles[`${variant}Bg`],
        styles[`${size}Size`],
        isDisabled && styles.disabled,
        style,
      ]}
      disabled={isDisabled}
      activeOpacity={0.7}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? colors.text : '#fff'} size="small" />
      ) : (
        <>
          {icon && <View style={styles.iconContainer}>{icon}</View>}
          <Text style={[styles[`${variant}Text`], styles[`${size}Text`], textStyle]}>
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

// Row of buttons
export function ButtonRow({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return (
    <View style={[styles.row, style]}>
      {React.Children.map(children, (child, i) => (
        <View style={[i > 0 && { marginLeft: spacing.sm }]}>{child}</View>
      ))}
    </View>
  );
}

// Minimal import for View wrapper
import { View } from 'react-native';

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.button,
    minHeight: 54,
  },
  primaryBg: {
    backgroundColor: colors.primary,
  },
  secondaryBg: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.cardBorderActive,
  },
  dangerBg: {
    backgroundColor: colors.error,
  },
  ghostBg: {
    backgroundColor: 'transparent',
  },
  smallSize: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  mediumSize: {
    minHeight: 54,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  largeSize: {
    minHeight: 60,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.base,
  },
  primaryText: {
    color: '#fff',
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold as any,
  },
  secondaryText: {
    color: colors.text,
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold as any,
  },
  dangerText: {
    color: '#fff',
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold as any,
  },
  ghostText: {
    color: colors.textSecondary,
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium as any,
  },
  smallText: {
    fontSize: fontSize.sm,
  },
  mediumText: {
    fontSize: fontSize.base,
  },
  largeText: {
    fontSize: fontSize.md,
  },
  disabled: {
    opacity: 0.4,
  },
  iconContainer: {
    marginRight: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
});