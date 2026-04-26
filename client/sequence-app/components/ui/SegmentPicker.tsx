import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, type ViewStyle } from 'react-native';
import { colors, radius, spacing, fontSize, fontWeight, shadows } from '@/theme';
import { SurfaceTexture } from '@/components/ui/GameTexture';
import { hapticSelection } from '@/lib/haptics';

interface SegmentOption<T extends string> {
  label: string;
  value: T;
}

interface SegmentPickerProps<T extends string> {
  options: SegmentOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
  style?: ViewStyle;
}

export function SegmentPicker<T extends string>({ options, selected, onSelect, style }: SegmentPickerProps<T>) {
  return (
    <View style={[styles.container, style]}>
      <SurfaceTexture variant="card" intensity="subtle" style={styles.texture} />
      {options.map((option) => (
        <TouchableOpacity
          key={option.value}
          style={[
            styles.option,
            selected === option.value && styles.optionSelected,
          ]}
          onPress={() => {
            hapticSelection();
            onSelect(option.value);
          }}
          activeOpacity={0.7}
        >
          {selected === option.value && <View pointerEvents="none" style={styles.selectedSheen} />}
          <Text style={[
            styles.optionText,
            selected === option.value && styles.optionTextSelected,
          ]}>
            {option.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

interface StepperProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  step?: number;
  label?: string;
  style?: ViewStyle;
}

export function Stepper({ value, min, max, onChange, step = 1, label, style }: StepperProps) {
  return (
    <View style={[styles.stepper, style]}>
      {label && <Text style={styles.stepperLabel}>{label}</Text>}
      <View style={styles.stepperRow}>
        <SurfaceTexture variant="card" intensity="subtle" style={styles.texture} />
        <TouchableOpacity
          style={[styles.stepperButton, value <= min && styles.stepperButtonDisabled]}
          onPress={() => {
            hapticSelection();
            onChange(Math.max(min, value - step));
          }}
          disabled={value <= min}
        >
          <Text style={styles.stepperButtonText}>−</Text>
        </TouchableOpacity>
        <View style={styles.stepperValue}>
          <Text style={styles.stepperValueText}>{value}</Text>
        </View>
        <TouchableOpacity
          style={[styles.stepperButton, value >= max && styles.stepperButtonDisabled]}
          onPress={() => {
            hapticSelection();
            onChange(Math.min(max, value + step));
          }}
          disabled={value >= max}
        >
          <Text style={styles.stepperButtonText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.cardBg,
    borderRadius: radius.md,
    padding: 3,
    position: 'relative',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  option: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  optionSelected: {
    backgroundColor: colors.primary,
    ...shadows.sm,
  },
  optionText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium as any,
  },
  optionTextSelected: {
    color: '#fff',
    fontWeight: fontWeight.semibold as any,
  },
  stepper: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  stepperLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium as any,
    marginBottom: spacing.xs,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderRadius: radius.md,
    padding: 3,
    position: 'relative',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  stepperButton: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.cardBgHover,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  stepperButtonDisabled: {
    opacity: 0.3,
  },
  stepperButtonText: {
    color: colors.text,
    fontSize: 20,
    fontWeight: fontWeight.bold as any,
  },
  stepperValue: {
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValueText: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold as any,
  },
  texture: {
    opacity: 0.35,
  },
  selectedSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '42%',
    backgroundColor: '#FFFFFF',
    opacity: 0.1,
  },
});
