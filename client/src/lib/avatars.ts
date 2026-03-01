/**
 * Avatar icon and color definitions for user profiles.
 */

export const AVATAR_ICONS = [
  { id: 'bear', emoji: '🐻' },
  { id: 'fox', emoji: '🦊' },
  { id: 'cat', emoji: '🐱' },
  { id: 'dog', emoji: '🐶' },
  { id: 'owl', emoji: '🦉' },
  { id: 'unicorn', emoji: '🦄' },
  { id: 'dragon', emoji: '🐉' },
  { id: 'octopus', emoji: '🐙' },
  { id: 'penguin', emoji: '🐧' },
  { id: 'koala', emoji: '🐨' },
  { id: 'lion', emoji: '🦁' },
  { id: 'wolf', emoji: '🐺' },
  { id: 'eagle', emoji: '🦅' },
  { id: 'rabbit', emoji: '🐰' },
  { id: 'panda', emoji: '🐼' },
  { id: 'alien', emoji: '👾' },
] as const;

export const AVATAR_COLORS = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#3b82f6', // blue
] as const;

export type AvatarIconId = typeof AVATAR_ICONS[number]['id'];
export type AvatarColor = typeof AVATAR_COLORS[number];

export function getAvatarEmoji(id: string): string {
  const icon = AVATAR_ICONS.find(i => i.id === id);
  return icon?.emoji || '👤';
}
