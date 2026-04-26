import { normalizeRoomCode, parseInviteRoomCode } from '@/lib/deepLinks';

describe('deep link parsing', () => {
  it('normalizes valid 5-character room codes', () => {
    expect(normalizeRoomCode('abc12')).toBe('ABC12');
    expect(normalizeRoomCode(['xy789'])).toBe('XY789');
  });

  it('rejects invalid room codes', () => {
    expect(normalizeRoomCode('ABC')).toBeNull();
    expect(normalizeRoomCode('ABC123')).toBeNull();
    expect(normalizeRoomCode(null)).toBeNull();
  });

  it('parses universal links from supported invite hosts', () => {
    expect(parseInviteRoomCode('https://sequence.wf/join/abc12')).toBe('ABC12');
    expect(parseInviteRoomCode('https://www.sequence.wf/invite/xy789')).toBe('XY789');
    expect(parseInviteRoomCode('https://sequence-for-friends.farazbukhari98.workers.dev/join/HELLO')).toBe('HELLO');
  });

  it('parses both custom scheme URL shapes', () => {
    expect(parseInviteRoomCode('sequencegame://join/abc12')).toBe('ABC12');
    expect(parseInviteRoomCode('sequencegame:///join/xy789')).toBe('XY789');
  });

  it('rejects unsupported hosts and paths', () => {
    expect(parseInviteRoomCode('https://example.com/join/ABCDE')).toBeNull();
    expect(parseInviteRoomCode('https://sequence.wf/privacy')).toBeNull();
    expect(parseInviteRoomCode('not a url')).toBeNull();
  });
});
