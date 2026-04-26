import React from 'react';
import { Animated, View, StyleSheet, TouchableOpacity, type ViewStyle } from 'react-native';
import { colors, radius, spacing, shadows } from '@/theme';
import { SurfaceTexture } from '@/components/ui/GameTexture';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: keyof typeof spacing;
  onPress?: () => void;
  active?: boolean;
}

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export function Card({ children, style, padding = 'base', onPress, active }: CardProps) {
  const pressProgress = React.useRef(new Animated.Value(0)).current;

  const animatePress = (toValue: number) => {
    Animated.spring(pressProgress, {
      toValue,
      useNativeDriver: true,
      speed: 24,
      bounciness: 6,
    }).start();
  };

  const animatedStyle = onPress
    ? {
        transform: [
          { translateY: pressProgress.interpolate({ inputRange: [0, 1], outputRange: [active ? -2 : 0, 2] }) },
          { scale: pressProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.985] }) },
        ],
      }
    : null;

  const content = (
    <>
      <SurfaceTexture variant="card" intensity="subtle" style={styles.texture} />
      <View style={styles.content}>{children}</View>
    </>
  );

  if (onPress) {
    return (
      <AnimatedTouchableOpacity
        style={[
          styles.card,
          { padding: spacing[padding] },
          active && styles.cardActive,
          style,
          animatedStyle,
        ]}
        onPress={onPress}
        onPressIn={() => animatePress(1)}
        onPressOut={() => animatePress(0)}
        activeOpacity={0.92}
      >
        {content}
      </AnimatedTouchableOpacity>
    );
  }

  return (
    <View
      style={[
        styles.card,
        { padding: spacing[padding] },
        active && styles.cardActive,
        active && styles.cardActiveLift,
        style,
      ]}
    >
      {content}
    </View>
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
    position: 'relative',
    // Drop shadow doesn't work if overflow is hidden on iOS sometimes, but we'll try to keep it
    ...shadows.sm,
  },
  cardActive: {
    borderColor: colors.cardBorderActive,
    backgroundColor: colors.cardBgHover,
    // Slightly lifted shadow when active
    ...shadows.md,
  },
  cardActiveLift: {
    transform: [{ translateY: -2 }],
  },
  texture: {
    opacity: 0.42,
  },
  content: {
    position: 'relative',
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
