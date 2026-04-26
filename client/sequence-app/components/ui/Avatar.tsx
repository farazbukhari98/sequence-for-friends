import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, AVATAR_SYMBOLS, AVATAR_COLORS, type AvatarColor } from '@/theme';

// Map symbol IDs to Ionicons names
const SYMBOL_TO_ICON: Record<string, string> = {
  spade: 'caret-up',
  heart: 'heart',
  diamond: 'diamond',
  club: 'leaf',
  crown: 'ribbon',
  ace: 'flash',
  chip: 'ellipse',
  dice: 'dice',
  joker: 'happy',
  king: 'shield',
  queen: 'flower',
  jack: 'person',
  star: 'star',
  shield: 'shield-checkmark',
  sword: 'flash-outline',
  gem: 'diamond-outline',
};

interface AvatarBubbleProps {
  avatarId: string;
  avatarColor: string;
  size?: number;
  showBorder?: boolean;
}

export function AvatarBubble({ avatarId, avatarColor, size = 44, showBorder = false }: AvatarBubbleProps) {
  const iconSize = Math.round(size * 0.5);

  // Check if avatarId is a symbol (new system) or potentially an emoji (legacy)
  const isSymbol = AVATAR_SYMBOLS.includes(avatarId as any);
  const iconName = isSymbol ? SYMBOL_TO_ICON[avatarId] : null;

  return (
    <View style={[
      styles.bubble,
      {
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: avatarColor || colors.primary,
      },
      showBorder && styles.bordered,
    ]}>
      {iconName ? (
        <Ionicons name={iconName as any} size={iconSize} color="#fff" />
      ) : (
        // Fallback: render first letter of avatarId if it's a name, or use default icon
        <Ionicons name="person" size={iconSize} color="#fff" />
      )}
    </View>
  );
}

interface AvatarPickerProps {
  selectedAvatar: string;
  selectedColor: string;
  onAvatarChange: (avatarId: string) => void;
  onColorChange: (color: string) => void;
}

export function AvatarPicker({ selectedAvatar, selectedColor, onAvatarChange, onColorChange }: AvatarPickerProps) {
  return (
    <View style={styles.picker}>
      <View style={styles.symbolGrid}>
        {AVATAR_SYMBOLS.map((symbol) => {
          const iconName = SYMBOL_TO_ICON[symbol];
          return (
            <TouchableOpacity
              key={symbol}
              style={[
                styles.symbolOption,
                selectedAvatar === symbol && styles.symbolOptionSelected,
              ]}
              onPress={() => onAvatarChange(symbol)}
            >
              <Ionicons
                name={iconName as any}
                size={24}
                color={selectedAvatar === symbol ? colors.primary : colors.text}
              />
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.colorRow}>
        {AVATAR_COLORS.map((color) => (
          <TouchableOpacity
            key={color}
            style={[
              styles.colorOption,
              { backgroundColor: color },
              selectedColor === color && styles.colorOptionSelected,
            ]}
            onPress={() => onColorChange(color)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bordered: {
    borderWidth: 2,
    borderColor: colors.gold,
  },
  picker: {
    gap: spacing.md,
  },
  symbolGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  symbolOption: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  symbolOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.cardBgHover,
  },
  colorRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  colorOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  colorOptionSelected: {
    borderColor: '#fff',
  },
});