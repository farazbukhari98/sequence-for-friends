import { useEffect } from 'react';
import type { MutableRefObject } from 'react';
import type { SequenceWebSocket } from '../lib/websocket';

/**
 * Detects app foreground/resume events and forces a WebSocket reconnect.
 *
 * On iOS, the OS kills WebSocket connections during background. The existing
 * backoff timer may be paused and resumes with stale delays. This hook
 * triggers an immediate reconnect when the app comes back to the foreground.
 *
 * Listens to:
 * - Capacitor `appStateChange` (native iOS/Android)
 * - `document.visibilitychange` (web / PWA)
 * - `window.focus` (desktop browser fallback)
 */
export function useAppLifecycle(
  wsRef: MutableRefObject<SequenceWebSocket | null>,
  tokenRef: MutableRefObject<string | null>,
): void {
  useEffect(() => {
    const tryReconnect = () => {
      // Only reconnect if we have active session credentials
      if (!tokenRef.current) return;
      wsRef.current?.forceReconnect();
    };

    // --- Capacitor native listener ---
    let capListenerRemove: (() => void) | null = null;

    // Dynamically import Capacitor App plugin (no-op on web if not installed)
    import('@capacitor/app')
      .then(({ App }) => {
        App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) {
            tryReconnect();
          }
        }).then(handle => {
          capListenerRemove = () => handle.remove();
        });
      })
      .catch(() => {
        // Capacitor not available (pure web) — that's fine
      });

    // --- Web visibility listener ---
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        tryReconnect();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // --- Focus listener (desktop fallback) ---
    const onFocus = () => tryReconnect();
    window.addEventListener('focus', onFocus);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
      capListenerRemove?.();
    };
  }, [wsRef, tokenRef]);
}
