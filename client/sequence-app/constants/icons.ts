// Icon mapping from semantic names to Ionicons
// This replaces all emojis throughout the app with proper icons

import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

// Main icon mapping - semantic names to Ionicons
export const ICONS: Record<string, IoniconsName> = {
  // Navigation & Actions
  friends: 'people-outline',
  friendsFilled: 'people',
  search: 'search-outline',
  searchFilled: 'search',
  share: 'share-outline',
  shareFilled: 'share',
  link: 'enter-outline',
  linkFilled: 'enter',
  add: 'add-circle-outline',
  addFilled: 'add-circle',
  back: 'chevron-back',
  forward: 'chevron-forward',
  close: 'close',
  check: 'checkmark',
  checkCircle: 'checkmark-circle',

  // Game related
  soloPractice: 'game-controller-outline',
  soloPracticeFilled: 'game-controller',
  createGame: 'add-circle-outline',
  joinGame: 'enter-outline',
  trophy: 'trophy-outline',
  trophyFilled: 'trophy',
  target: 'disc-outline',
  targetFilled: 'disc',
  deck: 'layers-outline',
  deckFilled: 'layers',
  cards: 'albums-outline',
  cardsFilled: 'albums',

  // Difficulty indicators
  easy: 'ellipse',
  medium: 'ellipse',
  hard: 'ellipse',
  impossible: 'skull-outline',
  impossibleFilled: 'skull',

  // Stats & History
  stats: 'bar-chart-outline',
  statsFilled: 'bar-chart',
  history: 'time-outline',
  historyFilled: 'time',
  timer: 'timer-outline',
  timerFilled: 'timer',
  hourglass: 'hourglass-outline',
  hourglassFilled: 'hourglass',

  // Insights
  avgTime: 'stopwatch-outline',
  jackUsage: 'disc-outline',
  firstMove: 'flash-outline',
  playTime: 'time-outline',

  // Emotions & States
  happy: 'happy-outline',
  happyFilled: 'happy',
  sad: 'sad-outline',
  sadFilled: 'sad',
  celebration: 'sparkles',
  star: 'star-outline',
  starFilled: 'star',

  // Players & Bots
  bot: 'hardware-chip-outline',
  botFilled: 'hardware-chip',
  person: 'person-outline',
  personFilled: 'person',

  // Empty States
  emptyFriends: 'people-outline',
  emptyRequests: 'mail-outline',
  emptySearch: 'search-outline',
  emptyHistory: 'time-outline',

  // Card Suits (for avatars and decorations)
  spade: 'triangle',
  heart: 'heart',
  diamond: 'diamond',
  club: 'leaf',

  // Royalty/Gaming
  crown: 'ribbon-outline',
  crownFilled: 'ribbon',
  shield: 'shield-outline',
  shieldFilled: 'shield',

  // Misc
  settings: 'settings-outline',
  settingsFilled: 'settings',
  info: 'information-circle-outline',
  infoFilled: 'information-circle',
  warning: 'warning-outline',
  warningFilled: 'warning',
  mail: 'mail-outline',
  mailFilled: 'mail',
} as const;

// Difficulty info with icons instead of emojis
export const DIFFICULTY_ICONS: Record<string, { icon: IoniconsName; color: string; label: string }> = {
  easy: { icon: 'ellipse', color: '#22c55e', label: 'Easy' },
  medium: { icon: 'ellipse', color: '#eab308', label: 'Medium' },
  hard: { icon: 'ellipse', color: '#ef4444', label: 'Hard' },
  impossible: { icon: 'skull', color: '#a855f7', label: 'Impossible' },
};

// Export icon names type for type safety
export type IconName = keyof typeof ICONS;
