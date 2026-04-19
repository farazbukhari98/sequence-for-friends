import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing, radius, AVATAR_EMOJIS, AVATAR_COLORS, type AvatarColor } from '@/theme';

interface AvatarBubbleProps {
  avatarId: string;
  avatarColor: string;
  size?: number;
  showBorder?: boolean;
}

export function AvatarBubble({ avatarId, avatarColor, size = 44, showBorder = false }: AvatarBubbleProps) {
  const emojiIndex = (AVATAR_EMOJIS as readonly string[]).indexOf(avatarId as string);
  const emoji = emojiIndex >= 0 ? AVATAR_EMOJIS[emojiIndex] : avatarId;
  const fontSize = Math.round(size * 0.5);

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
      <Text style={[styles.emoji, { fontSize: fontSize }]}>{emoji}</Text>
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
      <View style={styles.emojiGrid}>
        {AVATAR_EMOJIS.map((emoji) => (
          <TouchableOpacity
            key={emoji}
            style={[
              styles.emojiOption,
              selectedAvatar === emoji && styles.emojiOptionSelected,
            ]}
            onPress={() => onAvatarChange(emoji)}
          >
            <Text style={styles.emojiOptionText}>{emoji}</Text>
          </TouchableOpacity>
        ))}
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
    borderColor: colors.cardBorderActive,
  },
  emoji: {
    color: '#fff',
  },
  picker: {
    gap: spacing.md,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  emojiOption: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  emojiOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.cardBgHover,
  },
  emojiOptionText: {
    fontSize: 24,
  },
  colorRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
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