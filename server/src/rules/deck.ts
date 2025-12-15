import { randomInt } from 'crypto';
import type { CardCode, Suit, Rank } from '../../../shared/types.js';

const SUITS: Suit[] = ['S', 'H', 'D', 'C'];
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

/**
 * Create a standard 52-card deck
 */
function createSingleDeck(): CardCode[] {
  const deck: CardCode[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push(`${rank}${suit}` as CardCode);
    }
  }
  return deck;
}

/**
 * Create the full 104-card deck (two standard decks)
 */
export function createDeck(): CardCode[] {
  return [...createSingleDeck(), ...createSingleDeck()];
}

/**
 * Fisher-Yates shuffle using crypto.randomInt for secure randomness
 */
export function shuffleDeck(deck: CardCode[]): CardCode[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Deal cards from the deck
 * @param deck - The deck to deal from (will be mutated)
 * @param count - Number of cards to deal
 * @returns Array of dealt cards
 */
export function dealCards(deck: CardCode[], count: number): CardCode[] {
  if (deck.length < count) {
    throw new Error(`Not enough cards in deck: need ${count}, have ${deck.length}`);
  }
  return deck.splice(0, count);
}

/**
 * Draw a single card from the deck
 */
export function drawCard(deck: CardCode[]): CardCode | null {
  if (deck.length === 0) return null;
  return deck.shift() || null;
}

/**
 * Combine multiple discard piles into a new shuffled deck
 */
export function reshuffleDiscards(discardPiles: CardCode[][]): CardCode[] {
  const allCards: CardCode[] = [];
  for (const pile of discardPiles) {
    allCards.push(...pile);
  }
  return shuffleDeck(allCards);
}

/**
 * Get a single random card for cutting (to determine dealer)
 */
export function cutCard(deck: CardCode[]): CardCode {
  const index = randomInt(0, deck.length);
  return deck[index];
}
