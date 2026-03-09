import { describe, expect, it } from 'vitest';
import {
  addBotToRoom,
  addPlayerToRoom,
  createPlayer,
  createRoomData,
  getActiveModes,
  startGameInRoom,
  updateRoomSettings,
} from '../worker/src/room-logic';

function createReadyPlayer(name: string, isHost = false) {
  const player = createPlayer(name, isHost);
  player.ready = true;
  return player;
}

describe('King Of The Board room logic', () => {
  it('should normalize sequence length to 5 and preserve timer and series settings', () => {
    const host = createReadyPlayer('Host', true);
    const room = createRoomData('TEST1', 'Test Room', host, 4, 2, 30, 2, 4, 5);

    const result = updateRoomSettings(room, host.id, { gameVariant: 'king-of-the-board' });

    expect(result.error).toBeUndefined();
    expect(room.gameVariant).toBe('king-of-the-board');
    expect(room.sequenceLength).toBe(5);
    expect(room.turnTimeLimit).toBe(30);
    expect(room.seriesLength).toBe(5);
  });

  it('should not enable King Of The Board in rooms with bots', () => {
    const host = createReadyPlayer('Host', true);
    const room = createRoomData('TEST2', 'Test Room', host, 4, 2);

    const botResult = addBotToRoom(room, 'easy');
    expect('error' in botResult).toBe(false);

    const result = updateRoomSettings(room, host.id, { gameVariant: 'king-of-the-board' });

    expect(result.error).toContain('bot games');
  });

  it('should reject King Of The Board starts with fewer than 4 joined players', () => {
    const host = createReadyPlayer('Host', true);
    const room = createRoomData('TEST3', 'Test Room', host, 4, 2);

    const player2 = addPlayerToRoom(room, 'Player 2');
    const player3 = addPlayerToRoom(room, 'Player 3');
    if ('error' in player2 || 'error' in player3) {
      throw new Error('Failed to add players for test setup');
    }
    player2.ready = true;
    player3.ready = true;

    const variantResult = updateRoomSettings(room, host.id, { gameVariant: 'king-of-the-board' });
    expect(variantResult.error).toBeUndefined();

    const startResult = startGameInRoom(room, host.id);

    expect('error' in startResult).toBe(true);
    if ('error' in startResult) {
      expect(startResult.error).toContain('at least 4 players');
    }
  });

  it('should report king-of-the-board as an active multiplayer mode', () => {
    const modes = getActiveModes({
      sequenceLength: 5,
      turnTimeLimit: 30,
      seriesLength: 3,
      gameVariant: 'king-of-the-board',
    });

    expect(modes).toEqual(['king-of-the-board', 'series']);
  });
});
