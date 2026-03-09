import type { ReconnectErrorCode, ReconnectResponse } from '../../../shared/types';

export const REATTACH_RETRY_DELAYS = [0, 500, 1500] as const;

export interface ReconnectFailure {
  error: string;
  errorCode?: ReconnectErrorCode;
  terminal: boolean;
}

export type RetryReconnectResult<T> =
  | { success: true; value: T }
  | { success: false; failure: ReconnectFailure };

interface RetryReconnectOptions<T> {
  attempt: (attemptIndex: number) => Promise<RetryReconnectResult<T>>;
  isActive?: () => boolean;
  sleep?: (delayMs: number) => Promise<void>;
  delaysMs?: readonly number[];
}

export function isTerminalReconnectErrorCode(
  errorCode?: ReconnectErrorCode,
): boolean {
  return errorCode === 'INVALID_TOKEN' || errorCode === 'ROOM_EXPIRED';
}

export function classifyReconnectResponse(
  response: Pick<ReconnectResponse, 'success' | 'error' | 'errorCode'>,
): ReconnectFailure | null {
  if (response.success) {
    return null;
  }

  return {
    error: response.error || 'Failed to reconnect',
    errorCode: response.errorCode,
    terminal: isTerminalReconnectErrorCode(response.errorCode),
  };
}

export async function retryReconnect<T>({
  attempt,
  isActive = () => true,
  sleep = defaultSleep,
  delaysMs = REATTACH_RETRY_DELAYS,
}: RetryReconnectOptions<T>): Promise<RetryReconnectResult<T>> {
  let lastFailure: ReconnectFailure = {
    error: 'Failed to reconnect',
    terminal: false,
  };

  for (let i = 0; i < delaysMs.length; i++) {
    if (!isActive()) {
      return {
        success: false,
        failure: {
          error: 'Reconnect superseded',
          terminal: false,
        },
      };
    }

    const delayMs = delaysMs[i];
    if (delayMs > 0) {
      await sleep(delayMs);
      if (!isActive()) {
        return {
          success: false,
          failure: {
            error: 'Reconnect superseded',
            terminal: false,
          },
        };
      }
    }

    const result = await attempt(i);
    if (result.success) {
      return result;
    }

    lastFailure = result.failure;
    if (lastFailure.terminal) {
      return result;
    }
  }

  return {
    success: false,
    failure: lastFailure,
  };
}

function defaultSleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}
