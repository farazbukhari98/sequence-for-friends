import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, type ViewStyle } from 'react-native';
import { colors, radius, spacing, fontSize } from '@/theme';

interface ToastProps {
  message: string | null;
  type?: 'error' | 'success' | 'warning';
  onDismiss?: () => void;
  duration?: number;
}

export function Toast({ message, type = 'error', onDismiss, duration = 3000 }: ToastProps) {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!message) {
      Animated.parallel([
        Animated.timing(translateY, { toValue: -100, duration: 250, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();
      return;
    }

    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, { toValue: -100, duration: 250, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start(() => onDismiss?.());
    }, duration);

    return () => clearTimeout(timer);
  }, [message]);

  if (!message) return null;

  const bgColor = type === 'error' ? colors.error : type === 'success' ? colors.success : colors.warning;

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }], opacity }]}>
      <Text style={styles.message}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.error,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    zIndex: 999,
    alignItems: 'center',
  },
  message: {
    color: '#fff',
    fontSize: fontSize.base,
    fontWeight: '600',
  },
});