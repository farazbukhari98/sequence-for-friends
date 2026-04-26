import React, { useState } from 'react';
import { Animated, View, TouchableOpacity, Text, StyleSheet, ActivityIndicator, type TouchableOpacityProps, type TextStyle, type ViewStyle } from 'react-native';
import { colors, radius, spacing, fontSize, fontWeight, shadows } from '@/theme';
import { SurfaceTexture } from '@/components/ui/GameTexture';
import { hapticSelection } from '@/lib/haptics';

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

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export function Button({
  title,
  variant = 'primary',
  size = 'medium',
  loading = false,
  disabled = false,
  icon,
  style,
  textStyle,
  onPress,
  ...props
}: ButtonProps) {
  const [isPressed, setIsPressed] = useState(false);
  const pressProgress = React.useRef(new Animated.Value(0)).current;
  const isDisabled = disabled || loading;

  const animatePress = (toValue: number) => {
    if (variant === 'ghost') return;
    Animated.spring(pressProgress, {
      toValue,
      useNativeDriver: true,
      speed: 28,
      bounciness: 4,
    }).start();
  };

  const borderBottomWidth = isPressed ? 1 : (variant === 'ghost' ? 0 : 4);
  const animatedStyle = variant === 'ghost'
    ? undefined
    : {
        transform: [
          { translateY: pressProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 2] }) },
          { scale: pressProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.985] }) },
        ],
      };

  return (
    <AnimatedTouchableOpacity
      style={[
        styles.base,
        styles[`${variant}Bg`],
        styles[`${size}Size`],
        variant !== 'ghost' && { borderBottomWidth },
        isDisabled && styles.disabled,
        style,
        animatedStyle,
      ]}
      disabled={isDisabled}
      activeOpacity={0.9}
      onPressIn={(e) => {
        setIsPressed(true);
        animatePress(1);
        props.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setIsPressed(false);
        animatePress(0);
        props.onPressOut?.(e);
      }}
      onPress={(event) => {
        hapticSelection();
        onPress?.(event);
      }}
      {...props}
    >
      {variant !== 'ghost' && (
        <SurfaceTexture variant={variant === 'secondary' ? 'card' : 'wood'} intensity="subtle" style={styles.buttonTexture} />
      )}
      {variant !== 'ghost' && <View pointerEvents="none" style={styles.buttonSheen} />}
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' || variant === 'ghost' ? colors.textDark : '#fff'} size="small" />
      ) : (
        <View style={styles.content}>
          {icon && <View style={styles.iconContainer}>{icon}</View>}
          <Text style={[styles[`${variant}Text`], styles[`${size}Text`], textStyle]}>
            {title}
          </Text>
        </View>
      )}
    </AnimatedTouchableOpacity>
  );
}

// Row of buttons
export function ButtonRow({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return (
    <View style={[styles.row, style]}>
      {React.Children.map(children, (child, i) => (
        <View style={[styles.rowItem, i > 0 && { marginLeft: spacing.sm }]}>{child}</View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: 'transparent',
    position: 'relative',
    ...shadows.sm,
  },
  primaryBg: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  secondaryBg: {
    backgroundColor: colors.cardBg,
    borderColor: colors.primary, // Using wood brown for border of off-white button
  },
  dangerBg: {
    backgroundColor: colors.teamRed,
    borderColor: '#8B0000', // Dark red for bottom edge
  },
  ghostBg: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderBottomWidth: 0,
    elevation: 0,
    shadowColor: 'transparent',
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
    fontWeight: fontWeight.bold as any,
    letterSpacing: 0.5,
  },
  secondaryText: {
    color: colors.textDark,
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold as any,
    letterSpacing: 0.5,
  },
  dangerText: {
    color: '#fff',
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold as any,
    letterSpacing: 0.5,
  },
  ghostText: {
    color: colors.textOnDarkSecondary || '#F8F1E4',
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold as any,
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
    opacity: 0.5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  buttonTexture: {
    opacity: 0.22,
    borderRadius: radius.button,
  },
  buttonSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '44%',
    borderTopLeftRadius: radius.button,
    borderTopRightRadius: radius.button,
    backgroundColor: '#FFFFFF',
    opacity: 0.08,
  },
  iconContainer: {
    marginRight: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  rowItem: {
    flex: 1,
  },
});
