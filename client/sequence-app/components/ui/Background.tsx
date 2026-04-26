import React from 'react';
import { Animated, Image, View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, fontWeight, shadows } from '@/theme';
import { SurfaceTexture, TableEdgeVignette } from '@/components/ui/GameTexture';
import { gameImages } from '@/constants/gameAssets';

interface BackgroundProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

const isTestRuntime = (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV === 'test';

export function Background({ children, style }: BackgroundProps) {
  const feltDrift = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (isTestRuntime) return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(feltDrift, { toValue: 1, duration: 9000, useNativeDriver: true }),
        Animated.timing(feltDrift, { toValue: 0, duration: 9000, useNativeDriver: true }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [feltDrift]);

  const feltMotion = isTestRuntime
    ? undefined
    : {
        transform: [
          { translateX: feltDrift.interpolate({ inputRange: [0, 1], outputRange: [-10, 10] }) },
          { translateY: feltDrift.interpolate({ inputRange: [0, 1], outputRange: [0, 5] }) },
        ],
      };

  return (
    <View style={[styles.container, style]}>
      <LinearGradient
        colors={[colors.bgGradientStart, colors.bgGradientEnd]}
        style={styles.gradient}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <Image source={gameImages.feltTexture} style={styles.feltImage} resizeMode="cover" />
      <View style={styles.radialGradient} />
      <SurfaceTexture variant="felt" intensity="subtle" style={styles.fixedTexture} />
      <Animated.View pointerEvents="none" style={[styles.textureDrift, feltMotion]}>
        <SurfaceTexture variant="felt" intensity="medium" style={styles.fullTexture} />
      </Animated.View>
      <TableEdgeVignette />
      {children}
    </View>
  );
}

// Card Suits Logo - Four card suits in elegant arrangement
function FourSuitsDisplay({ size }: { size: number }) {
  const suitSize = Math.round(size * 0.32);
  const smallSuitSize = Math.round(size * 0.28);

  const blackSuit = '#1C1914';
  const redSuit = '#CC0000';

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Top - Spade */}
      <View style={{ position: 'absolute', top: 2 }}>
        <Ionicons name="caret-up" size={smallSuitSize} color={blackSuit} />
      </View>
      {/* Right - Heart */}
      <View style={{ position: 'absolute', right: 4 }}>
        <Ionicons name="heart" size={smallSuitSize} color={redSuit} />
      </View>
      {/* Bottom - Diamond */}
      <View style={{ position: 'absolute', bottom: 2 }}>
        <Ionicons name="diamond" size={smallSuitSize} color={redSuit} />
      </View>
      {/* Left - Club */}
      <View style={{ position: 'absolute', left: 4 }}>
        <Ionicons name="leaf" size={smallSuitSize} color={blackSuit} />
      </View>
      {/* Center gold diamond accent */}
      <View style={{ transform: [{ rotate: '45deg' }] }}>
        <Ionicons name="square" size={Math.round(size * 0.15)} color={colors.gold} />
      </View>
    </View>
  );
}

// Logo component with four card suits
export function Logo({ size = 'large' }: { size?: 'small' | 'large' }) {
  const isLarge = size === 'large';
  const iconSize = isLarge ? 60 : 44;

  return (
    <View style={styles.logoContainer}>
      <View style={[styles.logoCircle, isLarge && styles.logoCircleLarge]}>
        <LinearGradient
          colors={['#F8F1E4', '#E8DCC4']} // Off-white card color for the logo
          style={styles.logoGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <FourSuitsDisplay size={iconSize} />
      </View>
      {isLarge && (
        <>
          <Text style={styles.logoTitle}>SEQUENCE</Text>
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
  feltImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    opacity: 0.28,
  },
  radialGradient: {
    position: 'absolute',
    top: -150,
    left: '50%',
    transform: [{ translateX: -300 }],
    width: 600,
    height: 600,
    borderRadius: 300,
    backgroundColor: '#ffffff',
    opacity: 0.05, // Subtle spotlight mimicking a lamp over the table
  },
  fixedTexture: {
    opacity: 0.32,
    borderRadius: 0,
  },
  fullTexture: {
    borderRadius: 0,
  },
  textureDrift: {
    position: 'absolute',
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    opacity: 0.22,
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
    borderWidth: 2,
    borderColor: colors.gold + '80', // Stronger gold border
    ...shadows.md, // Adding shadow for physical feel
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 6,
  },
  logoCircleLarge: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  logoGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  logoTitle: {
    color: '#F8F1E4', // White-ish against the green felt
    fontSize: fontSize.huge,
    fontWeight: fontWeight.bold as any,
    letterSpacing: 3,
    marginTop: spacing.md,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  logoSubtitle: {
    color: colors.gold,
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium as any,
    marginTop: spacing.xs / 2,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
