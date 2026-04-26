import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';

type TextureVariant = 'felt' | 'wood' | 'card';

interface SurfaceTextureProps {
  variant?: TextureVariant;
  intensity?: 'subtle' | 'medium';
  style?: ViewStyle;
}

const feltFibers = [
  { top: '6%', left: '-8%', width: '72%', rotate: '-6deg', opacity: 0.16 },
  { top: '15%', left: '22%', width: '62%', rotate: '4deg', opacity: 0.12 },
  { top: '27%', left: '-14%', width: '86%', rotate: '2deg', opacity: 0.1 },
  { top: '39%', left: '12%', width: '70%', rotate: '-4deg', opacity: 0.13 },
  { top: '52%', left: '-4%', width: '58%', rotate: '5deg', opacity: 0.11 },
  { top: '64%', left: '28%', width: '76%', rotate: '-3deg', opacity: 0.12 },
  { top: '78%', left: '-18%', width: '92%', rotate: '3deg', opacity: 0.1 },
  { top: '90%', left: '18%', width: '66%', rotate: '-5deg', opacity: 0.13 },
] as const;

const flecks = [
  { top: '8%', left: '14%', size: 2, opacity: 0.22 },
  { top: '13%', left: '67%', size: 1, opacity: 0.18 },
  { top: '21%', left: '39%', size: 2, opacity: 0.14 },
  { top: '31%', left: '82%', size: 2, opacity: 0.2 },
  { top: '44%', left: '18%', size: 1, opacity: 0.16 },
  { top: '49%', left: '58%', size: 2, opacity: 0.18 },
  { top: '61%', left: '76%', size: 1, opacity: 0.16 },
  { top: '72%', left: '32%', size: 2, opacity: 0.2 },
  { top: '83%', left: '9%', size: 1, opacity: 0.14 },
  { top: '88%', left: '91%', size: 2, opacity: 0.18 },
] as const;

const woodLines = [
  { top: '12%', left: '-12%', width: '112%', rotate: '2deg', opacity: 0.18 },
  { top: '32%', left: '-6%', width: '104%', rotate: '-1deg', opacity: 0.13 },
  { top: '56%', left: '-10%', width: '116%', rotate: '1deg', opacity: 0.16 },
  { top: '78%', left: '-4%', width: '108%', rotate: '-2deg', opacity: 0.12 },
] as const;

const cardFibers = [
  { top: '18%', left: '8%', width: '84%', rotate: '-2deg', opacity: 0.1 },
  { top: '48%', left: '4%', width: '92%', rotate: '1deg', opacity: 0.08 },
  { top: '74%', left: '12%', width: '80%', rotate: '-1deg', opacity: 0.09 },
] as const;

export function SurfaceTexture({ variant = 'felt', intensity = 'subtle', style }: SurfaceTextureProps) {
  const fiberSet = variant === 'wood' ? woodLines : variant === 'card' ? cardFibers : feltFibers;
  const color = variant === 'felt' ? '#F8F1E4' : variant === 'wood' ? '#2A1408' : '#8B5A2B';
  const fleckColor = variant === 'felt' ? '#FFFFFF' : variant === 'wood' ? '#F8D49A' : '#1C1914';
  const opacityMultiplier = intensity === 'medium' ? 1.35 : 1;

  return (
    <View pointerEvents="none" style={[styles.fill, style]}>
      {fiberSet.map((fiber, index) => (
        <View
          key={`${variant}-fiber-${index}`}
          style={[
            styles.fiber,
            {
              top: fiber.top,
              left: fiber.left,
              width: fiber.width,
              backgroundColor: color,
              opacity: fiber.opacity * opacityMultiplier,
              transform: [{ rotate: fiber.rotate }],
            },
          ]}
        />
      ))}

      {flecks.map((fleck, index) => (
        <View
          key={`${variant}-fleck-${index}`}
          style={[
            styles.fleck,
            {
              top: fleck.top,
              left: fleck.left,
              width: fleck.size,
              height: fleck.size,
              borderRadius: fleck.size / 2,
              backgroundColor: fleckColor,
              opacity: fleck.opacity * opacityMultiplier,
            },
          ]}
        />
      ))}
    </View>
  );
}

export function TableEdgeVignette() {
  return (
    <View pointerEvents="none" style={styles.vignette}>
      <View style={[styles.edge, styles.edgeTop]} />
      <View style={[styles.edge, styles.edgeBottom]} />
      <View style={[styles.edgeSide, styles.edgeLeft]} />
      <View style={[styles.edgeSide, styles.edgeRight]} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    borderRadius: 8,
  },
  fiber: {
    position: 'absolute',
    height: 1,
  },
  fleck: {
    position: 'absolute',
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
  },
  edge: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: '#000',
    opacity: 0.1,
  },
  edgeTop: {
    top: 0,
  },
  edgeBottom: {
    bottom: 0,
  },
  edgeSide: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 72,
    backgroundColor: '#000',
    opacity: 0.07,
  },
  edgeLeft: {
    left: 0,
  },
  edgeRight: {
    right: 0,
  },
});
