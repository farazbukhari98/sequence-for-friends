import { Platform } from 'react-native';

// ============================================
// COLORS
// ============================================
export const colors = {
  // Brand
  primary: '#6366f1',
  primaryLight: '#818cf8',
  primaryDark: '#4f46e5',
  purple: '#8b5cf6',
  purpleLight: '#a78bfa',

  // Semantic
  success: '#22c55e',
  successLight: '#4ade80',
  error: '#ef4444',
  errorLight: '#f87171',
  warning: '#eab308',
  warningLight: '#facc15',
  cyan: '#06b6d4',
  orange: '#f97316',

  // Team
  teamBlue: '#2980b9',
  teamBlueLight: '#3498db',
  teamGreen: '#27ae60',
  teamGreenLight: '#2ecc71',
  teamRed: '#c0392b',
  teamRedLight: '#e74c3c',

  // Background
  background: '#050505',
  bgSecondary: '#0a0a0a',
  bgTertiary: '#111111',
  bgElevated: '#191919',
  bgGradientStart: '#050505',
  bgGradientEnd: '#0b1020',

  // Cards & Surfaces
  cardBg: 'rgba(255,255,255,0.06)',
  cardBgHover: 'rgba(255,255,255,0.10)',
  cardBorder: 'rgba(255,255,255,0.08)',
  cardBorderActive: 'rgba(255,255,255,0.20)',

  // Overlay
  overlay: 'rgba(0,0,0,0.6)',
  overlayLight: 'rgba(0,0,0,0.3)',

  // Text
  text: '#f8fafc',
  textSecondary: 'rgba(255,255,255,0.7)',
  textTertiary: 'rgba(255,255,255,0.5)',
  textDisabled: 'rgba(255,255,255,0.3)',

  // Misc
  border: 'rgba(255,255,255,0.12)',
  divider: 'rgba(255,255,255,0.06)',
  chip: 'rgba(255,255,255,0.08)',
} as const;

// ============================================
// SPACING
// ============================================
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  huge: 48,
  massive: 64,
} as const;

// ============================================
// BORDER RADIUS
// ============================================
export const radius = {
  sm: 8,
  md: 12,
  card: 14,
  lg: 16,
  xl: 18,
  button: 16,
  xxl: 20,
  full: 9999,
} as const;

// ============================================
// TYPOGRAPHY
// ============================================
export const fontFamily = Platform.select({
  ios: 'System',
  android: 'System',
  default: 'System',
});

export const fontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 28,
  huge: 34,
  display: 44,
} as const;

export const fontWeight: Record<string, '400' | '500' | '600' | '700'> = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
};

export const lineHeight = {
  tight: 1.15,
  normal: 1.35,
  relaxed: 1.55,
} as const;

// ============================================
// SHADOWS
// ============================================
export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  glow: {
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 0,
  },
} as const;

// ============================================
// ANIMATION
// ============================================
export const animation = {
  fast: 150,
  normal: 250,
  slow: 400,
  verySlow: 600,
} as const;

// ============================================
// AVATARS
// ============================================
export const AVATAR_EMOJIS = [
  '🐻', '🦊', '🐱', '🐶', '🦉', '🦄', '🐉', '🐙',
  '🐧', '🐨', '🦁', '🐺', '🦅', '🐰', '🐼', '👾',
] as const;

export const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6',
] as const;

export type AvatarEmoji = (typeof AVATAR_EMOJIS)[number];
export type AvatarColor = (typeof AVATAR_COLORS)[number];

// ============================================
// HELPERS
// ============================================
export function teamColor(color: string): string {
  switch (color) {
    case 'blue': return colors.teamBlue;
    case 'green': return colors.teamGreen;
    case 'red': return colors.teamRed;
    default: return colors.textTertiary;
  }
}

export function teamColorLight(color: string): string {
  switch (color) {
    case 'blue': return colors.teamBlueLight;
    case 'green': return colors.teamGreenLight;
    case 'red': return colors.teamRedLight;
    default: return colors.textTertiary;
  }
}

export const theme = {
  colors,
  spacing,
  radius,
  fontSize,
  fontWeight,
  lineHeight,
  shadows,
  animation,
  fontFamily,
} as const;

export default theme;