import { describe, it, expect } from 'vitest';
import {
  getCardDisplay,
  getCardFullName,
  formatDuration,
  formatMemberSince,
  formatGameDate,
  connectionIdle,
  connectionConnecting,
  connectionAttached,
  connectionRecovering,
  connectionOffline,
  connectionTerminalFailure,
  emptyStats,
} from '@/types/game';

describe('getCardDisplay', () => {
  it('returns wild display for W', () => {
    const result = getCardDisplay('W');
    expect(result.rank).toBe('★');
    expect(result.suit).toBe('');
    expect(result.suitColorHex).toBe('#facc15');
  });

  it('returns correct display for spade cards', () => {
    const result = getCardDisplay('AS');
    expect(result.rank).toBe('A');
    expect(result.suit).toBe('♠');
    expect(result.suitColorHex).toBe('#f8fafc');
  });

  it('returns correct display for heart cards', () => {
    const result = getCardDisplay('AH');
    expect(result.rank).toBe('A');
    expect(result.suit).toBe('♥');
    expect(result.suitColorHex).toBe('#ef4444');
  });

  it('returns correct display for diamond cards', () => {
    const result = getCardDisplay('TD');
    expect(result.rank).toBe('10');
    expect(result.suit).toBe('♦');
    expect(result.suitColorHex).toBe('#ef4444');
  });

  it('returns correct display for club cards', () => {
    const result = getCardDisplay('KC');
    expect(result.rank).toBe('K');
    expect(result.suit).toBe('♣');
    expect(result.suitColorHex).toBe('#f8fafc');
  });

  it('handles numeric rank cards', () => {
    const result = getCardDisplay('2S');
    expect(result.rank).toBe('2');
    expect(result.suit).toBe('♠');
  });

  it('handles jack cards', () => {
    const jackSpade = getCardDisplay('JS');
    expect(jackSpade.rank).toBe('J');
    expect(jackSpade.suit).toBe('♠');
  });
});

describe('getCardFullName', () => {
  it('returns Wild Corner for W', () => {
    expect(getCardFullName('W')).toBe('Wild Corner');
  });

  it('returns full names for standard cards', () => {
    expect(getCardFullName('AS')).toBe('Ace of Spades');
    expect(getCardFullName('KH')).toBe('King of Hearts');
    expect(getCardFullName('2C')).toBe('2 of Clubs');
    expect(getCardFullName('TD')).toBe('10 of Diamonds');
  });

  it('returns full name for jack cards', () => {
    expect(getCardFullName('JH')).toBe('Jack of Hearts');
    expect(getCardFullName('JS')).toBe('Jack of Spades');
    expect(getCardFullName('JD')).toBe('Jack of Diamonds');
    expect(getCardFullName('JC')).toBe('Jack of Clubs');
  });
});

describe('formatDuration', () => {
  it('formats seconds', () => {
    expect(formatDuration(30000)).toBe('30s');
    expect(formatDuration(5000)).toBe('5s');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(90000)).toBe('1m 30s');
    expect(formatDuration(60000)).toBe('1m');
  });

  it('formats hours and minutes', () => {
    expect(formatDuration(3600000)).toBe('1h');
    expect(formatDuration(5400000)).toBe('1h 30m');
    expect(formatDuration(9000000)).toBe('2h 30m');
  });
});

describe('formatMemberSince', () => {
  it('produces a date string', () => {
    const ts = Date.now() * 1000; // microseconds
    const result = formatMemberSince(ts);
    expect(result).toMatch(/\w{3} \d{4}/);
  });
});

describe('formatGameDate', () => {
  it('produces a date string with day', () => {
    const ts = Date.now() * 1000; // microseconds  
    const result = formatGameDate(ts);
    expect(result).toMatch(/\w{3} \d{1,2}, \d{4}/);
  });
});

describe('Connection status factories', () => {
  it('connectionIdle has correct shape', () => {
    expect(connectionIdle).toEqual({
      phase: 'idle',
      message: null,
      attempt: 0,
      canRetry: false,
    });
  });

  it('connectionConnecting sets phase and message', () => {
    const status = connectionConnecting('Connecting...');
    expect(status.phase).toBe('connecting');
    expect(status.message).toBe('Connecting...');
    expect(status.canRetry).toBe(false);
  });

  it('connectionAttached works with and without message', () => {
    const withMsg = connectionAttached('Connected');
    expect(withMsg.phase).toBe('attached');
    expect(withMsg.message).toBe('Connected');

    const without = connectionAttached();
    expect(without.message).toBeNull();
  });

  it('connectionRecovering includes attempt', () => {
    const status = connectionRecovering('Reconnecting...', 2);
    expect(status.phase).toBe('recovering');
    expect(status.attempt).toBe(2);
    expect(status.canRetry).toBe(false);
  });

  it('connectionOffline sets canRetry true', () => {
    const status = connectionOffline('Lost connection');
    expect(status.phase).toBe('offline');
    expect(status.canRetry).toBe(true);
  });

  it('connectionTerminalFailure sets canRetry from param', () => {
    const retryable = connectionTerminalFailure('Error', true);
    expect(retryable.canRetry).toBe(true);

    const fatal = connectionTerminalFailure('Gone', false);
    expect(fatal.canRetry).toBe(false);
  });
});

describe('emptyStats', () => {
  it('has all zero default values', () => {
    expect(emptyStats.gamesPlayed).toBe(0);
    expect(emptyStats.gamesWon).toBe(0);
    expect(emptyStats.winRate).toBe(0);
    expect(emptyStats.currentWinStreak).toBe(0);
    expect(emptyStats.hasBeatImpossibleBot).toBe(false);
    expect(emptyStats.fastestWinMs).toBeNull();
  });
});