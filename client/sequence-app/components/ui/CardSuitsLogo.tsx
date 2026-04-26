import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, fontWeight } from '@/theme';

interface CardSuitsLogoProps {
  size?: 'small' | 'large';
}

// Four card suits arrangement using Ionicons
function FourSuitsDisplay({ size }: { size: number }) {
  const suitSize = Math.round(size * 0.28);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Top - Spade */}
      <View style={{ position: 'absolute', top: size * 0.08 }}>
        <Ionicons name="caret-up" size={suitSize} color="#1a1a2e" />
      </View>
      {/* Right - Heart */}
      <View style={{ position: 'absolute', right: size * 0.08 }}>
        <Ionicons name="heart" size={suitSize} color="#ef4444" />
      </View>
      {/* Bottom - Diamond */}
      <View style={{ position: 'absolute', bottom: size * 0.08 }}>
        <Ionicons name="diamond" size={suitSize} color="#ef4444" />
      </View>
      {/* Left - Club */}
      <View style={{ position: 'absolute', left: size * 0.08 }}>
        <Ionicons name="leaf" size={suitSize} color="#1a1a2e" />
      </View>
      {/* Center gold diamond accent */}
      <View style={{ transform: [{ rotate: '45deg' }] }}>
        <Ionicons name="square" size={Math.round(size * 0.15)} color={colors.gold} />
      </View>
    </View>
  );
}

export function CardSuitsLogo({ size = 'large' }: CardSuitsLogoProps) {
  const isLarge = size === 'large';
  const iconSize = isLarge ? 60 : 44;

  return (
    <View style={styles.container}>
      <View style={[styles.logoWrapper, isLarge && styles.logoWrapperLarge]}>
        <LinearGradient
          colors={[colors.bgElevated, colors.bgTertiary]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <FourSuitsDisplay size={iconSize} />
      </View>
      {isLarge && (
        <>
          <Text style={styles.title}>SEQUENCE</Text>
          <Text style={styles.subtitle}>For Friends</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  logoWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.gold + '40',
  },
  logoWrapperLarge: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  title: {
    color: colors.text,
    fontSize: fontSize.huge,
    fontWeight: fontWeight.bold as any,
    letterSpacing: 3,
    marginTop: spacing.md,
  },
  subtitle: {
    color: colors.gold,
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium as any,
    marginTop: spacing.xs / 2,
  },
});

export default CardSuitsLogo;
