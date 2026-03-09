import { useEffect } from 'react';
import type { MutableRefObject } from 'react';
import { Capacitor } from '@capacitor/core';
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
  roomCodeRef: MutableRefObject<string | null>,
): void {
  useEffect(() => {
    let wasBackgrounded = false;
    let lastResumeAt = 0;
    const cooldownMs = 1500;

    const tryReconnect = () => {
      const now = Date.now();
      if (now - lastResumeAt < cooldownMs) return;
      if (!tokenRef.current || !roomCodeRef.current) return;
      const ws = wsRef.current;
      if (!ws) return;
      lastResumeAt = now;
      wasBackgrounded = false;
      ws.forceReconnect();
    };

    let capListenerRemove: (() => void) | null = null;
    const isNative = Capacitor.isNativePlatform();

    if (isNative) {
      import('@capacitor/app')
        .then(({ App }) => {
          App.addListener('appStateChange', ({ isActive }) => {
            if (!isActive) {
              wasBackgrounded = true;
              return;
            }
            if (wasBackgrounded) {
              tryReconnect();
            }
          }).then(handle => {
            capListenerRemove = () => handle.remove();
          });
        })
        .catch(() => {
          // Capacitor App plugin unavailable - ignore on web
        });
    } else {
      const onVisibilityChange = () => {
        if (document.visibilityState === 'hidden') {
          wasBackgrounded = true;
          return;
        }
        if (document.visibilityState === 'visible' && wasBackgrounded) {
          tryReconnect();
        }
      };

      const onFocus = () => {
        if (document.visibilityState === 'visible' && wasBackgrounded) {
          tryReconnect();
        }
      };

      document.addEventListener('visibilitychange', onVisibilityChange);
      window.addEventListener('focus', onFocus);

      return () => {
        document.removeEventListener('visibilitychange', onVisibilityChange);
        window.removeEventListener('focus', onFocus);
      };
    }

    return () => {
      capListenerRemove?.();
    };
  }, [wsRef, tokenRef, roomCodeRef]);
}
