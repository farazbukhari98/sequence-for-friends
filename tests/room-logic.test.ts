import { describe, expect, it } from 'vitest';
import {
  addBotToRoom,
  addPlayerToRoom,
  continueSeriesInRoom,
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

function createReadySeriesRoom(seriesLength: 3 | 5 | 7 = 3) {
  const host = createReadyPlayer('Host', true);
  const room = createRoomData('SERIES', 'Series Room', host, 4, 2, 0, 2, 5, seriesLength);

  for (const name of ['Player 2', 'Player 3', 'Player 4']) {
    const player = addPlayerToRoom(room, name);
    if ('error' in player) {
      throw new Error(`Failed to add player ${name} for test setup`);
    }
    player.ready = true;
  }

  const startResult = startGameInRoom(room, host.id);
  if ('error' in startResult) {
    throw new Error(`Failed to start series room for test setup: ${startResult.error}`);
  }

  return { room, host };
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

  it('should attach a missing user id when a player reconnects with an existing token', () => {
    const host = createReadyPlayer('Host', true);
    const room = createRoomData('TEST4', 'Test Room', host, 4, 2);

    const player = addPlayerToRoom(room, 'Player 2');
    if ('error' in player) {
      throw new Error('Failed to add player for test setup');
    }

    player.userId = undefined;

    const reconnected = addPlayerToRoom(room, 'Player 2', player.token, 'user-123');
    if ('error' in reconnected) {
      throw new Error('Failed to reconnect player for test setup');
    }

    expect(reconnected.id).toBe(player.id);
    expect(reconnected.userId).toBe('user-123');
  });

  it('should advance series wins and games played when continuing to the next game', () => {
    const { room, host } = createReadySeriesRoom(3);

    if (!room.gameState) {
      throw new Error('Expected game state for test setup');
    }
    room.gameState.winnerTeamIndex = 0;

    const result = continueSeriesInRoom(room, host.id);

    expect('error' in result).toBe(false);
    expect(room.seriesState).toMatchObject({
      gamesPlayed: 1,
      teamWins: [1, 0],
      seriesWinnerTeamIndex: null,
    });
    expect(room.gameState?.winnerTeamIndex).toBeNull();
    expect(room.phase).toBe('in-game');
  });

  it('should finalize the series when a team reaches the required number of wins', () => {
    const { room, host } = createReadySeriesRoom(3);

    if (!room.gameState) {
      throw new Error('Expected game state for test setup');
    }
    room.gameState.winnerTeamIndex = 0;

    const firstResult = continueSeriesInRoom(room, host.id);
    if ('error' in firstResult) {
      throw new Error(`Expected series to continue after first win: ${firstResult.error}`);
    }

    if (!room.gameState) {
      throw new Error('Expected next game state after first series win');
    }
    room.gameState.winnerTeamIndex = 0;

    const finalResult = continueSeriesInRoom(room, host.id);

    expect('error' in finalResult).toBe(true);
    if ('error' in finalResult) {
      expect(finalResult.error).toBe('Series over');
    }
    expect(room.seriesState).toMatchObject({
      gamesPlayed: 2,
      teamWins: [2, 0],
      seriesWinnerTeamIndex: 0,
    });
    expect(room.phase).toBe('waiting');
    expect(room.gameState).toBeNull();
    expect(room.players.map(player => player.ready)).toEqual([true, false, false, false]);
  });
});
