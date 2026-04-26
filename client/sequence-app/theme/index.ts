import { Platform } from 'react-native';

// ============================================
// COLORS - Classic Game Night Theme
// ============================================
export const colors = {
  // Brand - Wood Brown & Brass
  primary: '#8B5A2B', // Rich wood brown
  primaryLight: '#A67D46',
  primaryDark: '#663E14',
  purple: '#8B5A2B', // Kept for backwards compatibility
  purpleLight: '#A67D46',

  // Luxury Accents - Gold/Brass
  gold: '#D4AF37',
  goldLight: '#F4D03F',
  champagne: '#F7E7CE',

  // Semantic
  success: '#22c55e',
  successLight: '#4ade80',
  error: '#ef4444',
  errorLight: '#f87171',
  warning: '#eab308',
  warningLight: '#facc15',
  cyan: '#06b6d4',
  orange: '#f97316',

  // Team - Saturated Poker Chip Colors
  teamBlue: '#0052A3',
  teamBlueLight: '#337ECC',
  teamGreen: '#008000',
  teamGreenLight: '#339933',
  teamRed: '#CC0000',
  teamRedLight: '#E63333',

  // Background - Deep Felt Green
  background: '#0D3B22',
  bgSecondary: '#114D2E',
  bgTertiary: '#165A36',
  bgElevated: '#1A6A40',
  bgGradientStart: '#0D3B22',
  bgGradientEnd: '#165A36',

  // Cards & Surfaces with wood/brass borders
  cardBg: '#F8F1E4', // Off-white, crisp warm color mimicking cards
  cardBgHover: '#E8DCC4',
  cardBorder: 'rgba(139, 90, 43, 0.4)', // Wood brown border
  cardBorderActive: '#8B5A2B',

  // Overlay
  overlay: 'rgba(0,0,0,0.6)',
  overlayLight: 'rgba(0,0,0,0.3)',

  // Text (Dark for light cards/surfaces - default since most content is on cards)
  text: '#1C1914',
  textSecondary: '#5C5446',
  textTertiary: '#8C8373',
  textDisabled: 'rgba(28, 25, 20, 0.3)',

  // Light text for dark backgrounds (felt)
  textOnDark: '#f8fafc',
  textOnDarkSecondary: 'rgba(255,255,255,0.7)',
  textOnDarkTertiary: 'rgba(255,255,255,0.5)',

  // Dark text explicitly
  textDark: '#1C1914',
  textDarkSecondary: '#5C5446',
  textDarkTertiary: '#8C8373',

  // Misc
  border: 'rgba(139, 90, 43, 0.3)',
  divider: 'rgba(28, 25, 20, 0.1)',
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
  sm: 4,
  md: 8,
  card: 10,
  lg: 12,
  xl: 16,
  button: 8,
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
// SHADOWS - Sharper and grounded
// ============================================
export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 6,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 10,
  },
  glow: {
    shadowColor: '#8B5A2B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 0,
  },
  goldGlow: {
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
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
// AVATARS - Game-themed symbols
// ============================================
// Symbol IDs that map to Ionicons
export const AVATAR_SYMBOLS = [
  'spade',      // Card suits
  'heart',
  'diamond',
  'club',
  'crown',      // Gaming/Royalty
  'ace',
  'chip',
  'dice',
  'joker',      // Face cards
  'king',
  'queen',
  'jack',
  'star',       // Premium
  'shield',
  'sword',
  'gem',
] as const;

// Map symbol IDs to Ionicons names
export const AVATAR_ICON_MAP: Record<string, string> = {
  spade: 'spade',
  heart: 'heart',
  diamond: 'diamond',
  club: 'club',
  crown: 'ribbon',
  ace: 'flash',
  chip: 'ellipse',
  dice: 'dice',
  joker: 'happy',
  king: 'shield',
  queen: 'flower',
  jack: 'male',
  star: 'star',
  shield: 'shield-checkmark',
  sword: 'flash',
  gem: 'diamond',
};

export const AVATAR_COLORS = [
  '#0052A3', '#008000', '#CC0000', '#8B5A2B',
  '#D4AF37', '#eab308', '#f97316', '#06b6d4',
  '#14b8a6', '#ec4899',
] as const;

// Legacy support - keeping AVATAR_EMOJIS for backward compatibility during migration
export const AVATAR_EMOJIS = AVATAR_SYMBOLS;

export type AvatarSymbol = (typeof AVATAR_SYMBOLS)[number];
export type AvatarColor = (typeof AVATAR_COLORS)[number];
// Legacy type alias
export type AvatarEmoji = AvatarSymbol;

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