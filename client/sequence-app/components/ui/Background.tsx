import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, fontSize, fontWeight } from '@/theme';

interface BackgroundProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function Background({ children, style }: BackgroundProps) {
  return (
    <View style={[styles.container, style]}>
      <LinearGradient
        colors={[colors.bgGradientStart, colors.bgGradientEnd]}
        style={styles.gradient}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <View style={styles.radialGradient} />
      {children}
    </View>
  );
}

// Logo component
export function Logo({ size = 'large' }: { size?: 'small' | 'large' }) {
  const isLarge = size === 'large';
  return (
    <View style={styles.logoContainer}>
      <View style={[styles.logoCircle, isLarge && styles.logoCircleLarge]}>
        <LinearGradient
          colors={[colors.primary, colors.purple]}
          style={styles.logoGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <Text style={[styles.logoLetter, isLarge && styles.logoLetterLarge]}>S</Text>
      </View>
      {isLarge && (
        <>
          <Text style={styles.logoTitle}>Sequence</Text>
          <Text style={styles.logoSubtitle}>For Friends</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  gradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  radialGradient: {
    position: 'absolute',
    top: -100,
    left: '50%',
    transform: [{ translateX: -200 }],
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: colors.primary,
    opacity: 0.06,
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCircleLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  logoGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  logoLetter: {
    color: '#fff',
    fontSize: 28,
    fontWeight: fontWeight.bold as any,
  },
  logoLetterLarge: {
    fontSize: 36,
  },
  logoTitle: {
    color: colors.text,
    fontSize: fontSize.huge,
    fontWeight: fontWeight.bold as any,
    marginTop: spacing.md,
  },
  logoSubtitle: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium as any,
    marginTop: spacing.xs / 2,
  },
});