import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, type ViewStyle } from 'react-native';
import { colors, radius, spacing, fontSize, fontWeight } from '@/theme';

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
      {options.map((option) => (
        <TouchableOpacity
          key={option.value}
          style={[
            styles.option,
            selected === option.value && styles.optionSelected,
          ]}
          onPress={() => onSelect(option.value)}
          activeOpacity={0.7}
        >
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
        <TouchableOpacity
          style={[styles.stepperButton, value <= min && styles.stepperButtonDisabled]}
          onPress={() => onChange(Math.max(min, value - step))}
          disabled={value <= min}
        >
          <Text style={styles.stepperButtonText}>−</Text>
        </TouchableOpacity>
        <View style={styles.stepperValue}>
          <Text style={styles.stepperValueText}>{value}</Text>
        </View>
        <TouchableOpacity
          style={[styles.stepperButton, value >= max && styles.stepperButtonDisabled]}
          onPress={() => onChange(Math.min(max, value + step))}
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
  },
  option: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionSelected: {
    backgroundColor: colors.primary,
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
  },
  stepperButton: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.cardBgHover,
    alignItems: 'center',
    justifyContent: 'center',
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
});