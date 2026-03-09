import {
  REATTACH_RETRY_DELAYS,
  classifyReconnectResponse,
  isTerminalReconnectErrorCode,
  retryReconnect,
} from '../client/src/lib/reconnect';

describe('reconnect helpers', () => {
  it('treats explicit reconnect error codes as terminal', () => {
    expect(isTerminalReconnectErrorCode('INVALID_TOKEN')).toBe(true);
    expect(isTerminalReconnectErrorCode('ROOM_EXPIRED')).toBe(true);
    expect(isTerminalReconnectErrorCode(undefined)).toBe(false);
  });

  it('classifies reconnect responses correctly', () => {
    expect(REATTACH_RETRY_DELAYS).toEqual([0, 500, 1500]);

    const invalidToken = classifyReconnectResponse({
      success: false,
      error: 'Invalid token',
      errorCode: 'INVALID_TOKEN',
    });
    expect(invalidToken).toEqual({
      error: 'Invalid token',
      errorCode: 'INVALID_TOKEN',
      terminal: true,
    });

    const transient = classifyReconnectResponse({
      success: false,
      error: 'Request timeout',
    });
    expect(transient).toEqual({
      error: 'Request timeout',
      errorCode: undefined,
      terminal: false,
    });
  });

  it('retries transient failures and stops on success', async () => {
    const attempts: number[] = [];
    const delays: number[] = [];

    const result = await retryReconnect({
      sleep: async (delayMs) => {
        delays.push(delayMs);
      },
      attempt: async (attemptIndex) => {
        attempts.push(attemptIndex);
        if (attemptIndex < 2) {
          return {
            success: false as const,
            failure: {
              error: 'Request timeout',
              terminal: false,
            },
          };
        }

        return {
          success: true as const,
          value: { playerId: 'player-1' },
        };
      },
    });

    expect(result).toEqual({
      success: true,
      value: { playerId: 'player-1' },
    });
    expect(attempts).toEqual([0, 1, 2]);
    expect(delays).toEqual([500, 1500]);
  });

  it('stops immediately on terminal failures', async () => {
    const attempts: number[] = [];
    const sleep = vi.fn(async () => {});

    const result = await retryReconnect({
      sleep,
      attempt: async (attemptIndex) => {
        attempts.push(attemptIndex);
        return {
          success: false as const,
          failure: {
            error: 'Invalid token',
            errorCode: 'INVALID_TOKEN' as const,
            terminal: true,
          },
        };
      },
    });

    expect(result).toEqual({
      success: false,
      failure: {
        error: 'Invalid token',
        errorCode: 'INVALID_TOKEN',
        terminal: true,
      },
    });
    expect(attempts).toEqual([0]);
    expect(sleep).not.toHaveBeenCalled();
  });
});
