import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ICONS, type IconName } from '@/constants/icons';
import { colors } from '@/theme';

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  style?: any;
}

export function Icon({ name, size = 24, color = colors.text, style }: IconProps) {
  const iconName = ICONS[name];

  if (!iconName) {
    console.warn(`Icon "${name}" not found in ICONS mapping`);
    return null;
  }

  return (
    <Ionicons
      name={iconName}
      size={size}
      color={color}
      style={style}
    />
  );
}

// Card suit icons with custom SVG-like rendering using Ionicons
interface CardSuitIconProps {
  suit: 'spade' | 'heart' | 'diamond' | 'club';
  size?: number;
  color?: string;
  filled?: boolean;
}

export function CardSuitIcon({ suit, size = 24, color, filled = true }: CardSuitIconProps) {
  const suitColors: Record<string, string> = {
    spade: '#1a1a2e',
    heart: '#ef4444',
    diamond: '#ef4444',
    club: '#1a1a2e',
  };

  const suitIcons: Record<string, string> = {
    spade: filled ? 'caret-up' : 'caret-up-outline',
    heart: filled ? 'heart' : 'heart-outline',
    diamond: filled ? 'diamond' : 'diamond-outline',
    club: filled ? 'leaf' : 'leaf-outline',
  };

  const iconColor = color ?? suitColors[suit];

  return (
    <Ionicons
      name={suitIcons[suit] as any}
      size={size}
      color={iconColor}
    />
  );
}

// Difficulty indicator icon
interface DifficultyIconProps {
  difficulty: 'easy' | 'medium' | 'hard' | 'impossible';
  size?: number;
  showLabel?: boolean;
}

export function DifficultyIcon({ difficulty, size = 16, showLabel = false }: DifficultyIconProps) {
  const config: Record<string, { icon: string; color: string; label: string }> = {
    easy: { icon: 'ellipse', color: '#22c55e', label: 'Easy' },
    medium: { icon: 'ellipse', color: '#eab308', label: 'Medium' },
    hard: { icon: 'ellipse', color: '#ef4444', label: 'Hard' },
    impossible: { icon: 'skull', color: '#a855f7', label: 'Impossible' },
  };

  const { icon, color, label } = config[difficulty];

  return (
    <Ionicons
      name={icon as any}
      size={size}
      color={color}
    />
  );
}

export default Icon;
