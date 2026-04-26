import { WS_BASE_URL, RECONNECT_RETRY_DELAYS, HEARTBEAT_INTERVAL, HEARTBEAT_TIMEOUT } from '@/constants/api';

type MessageHandler = (type: string, data: any) => void;
type SocketStatus = 'connected' | 'disconnected' | 'connecting' | 'reconnecting';
type SocketStatusInfo = { code?: number; reason?: string; wasClean?: boolean };
type StatusHandler = (status: SocketStatus, info?: SocketStatusInfo) => void;

export class SocketManager {
  private ws: WebSocket | null = null;
  private connectionId: number = 0;
  private path: string = '';
  private authToken: string = '';
  private messageHandlers: MessageHandler[] = [];
  private statusHandlers: StatusHandler[] = [];
  private reconnectAttempts: number = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;
  private pendingRequests: Map<string, { resolve: (data: any) => void; reject: (err: Error) => void; timeout: ReturnType<typeof setTimeout> }> = new Map();
  private requestIdCounter: number = 0;
  private disposed: boolean = false;

  connect(path: string, authToken?: string): Promise<void> {
    this.disconnect();
    this.path = path;
    this.authToken = authToken ?? '';
    this.disposed = false;
    this.reconnectAttempts = 0;
    const connectionId = ++this.connectionId;

    return new Promise((resolve, reject) => {
      let settled = false;
      const resolveOnce = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      const rejectOnce = (error: Error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };

      try {
        const url = new URL(`${WS_BASE_URL}${path}`);
        if (this.authToken) {
          url.searchParams.set('auth', this.authToken);
        }
        const ws = new WebSocket(url.toString());

        ws.onopen = () => {
          if (connectionId !== this.connectionId) {
            try { ws.close(1000, 'Stale connection'); } catch {}
            return;
          }
          this.ws = ws;
          this.startHeartbeat();
          this.notifyStatus('connected');
          resolveOnce();
        };

        ws.onmessage = (event) => {
          if (connectionId !== this.connectionId) return;
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (e) {
            console.warn('Failed to parse WebSocket message:', e);
          }
        };

        ws.onclose = (event) => {
          if (connectionId !== this.connectionId || (this.ws !== null && this.ws !== ws)) {
            return;
          }
          this.ws = null;
          this.stopHeartbeat();
          this.failAllPending(new Error(event.reason || 'Socket disconnected'));
          this.notifyStatus('disconnected', {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
          });
          rejectOnce(new Error(event.reason || 'Socket disconnected'));
        };

        ws.onerror = () => {
          if (connectionId !== this.connectionId) return;
          this.notifyStatus('disconnected');
          if (!this.ws) {
            rejectOnce(new Error('Failed to connect'));
          }
        };

        this.notifyStatus('connecting');
      } catch (err) {
        rejectOnce(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  disconnect() {
    this.disposed = true;
    this.connectionId++;
    this.clearReconnectTimer();
    this.stopHeartbeat();
    this.failAllPending(new Error('Disconnected'));
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.notifyStatus('disconnected', { code: 1000, reason: 'Client disconnect', wasClean: true });
  }

  request(type: string, data?: any, timeoutMs: number = 10000): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject(new Error('Socket is not connected'));
        return;
      }

      const id = String(++this.requestIdCounter);
      const message = { type, id, data: data ?? {} };

      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${type}`));
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timeout: timer });
      this.sendRaw(message);
    });
  }

  send(type: string, data?: any) {
    this.sendRaw(data === undefined ? { type } : { type, data });
  }

  onMessage(handler: MessageHandler) {
    this.messageHandlers.push(handler);
    return () => {
      this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
    };
  }

  onStatus(handler: StatusHandler) {
    this.statusHandlers.push(handler);
    return () => {
      this.statusHandlers = this.statusHandlers.filter(h => h !== handler);
    };
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // Private methods

  private sendRaw(message: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private handleMessage(message: any) {
    // Handle ping/pong for heartbeat
    if (message.type === 'pong') {
      this.clearHeartbeatTimeout();
      return;
    }

    // Handle request responses
    if (message.type === 'response' && message.id) {
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(message.id);
        pending.resolve(message.data);
      }
      return;
    }

    // Notify message handlers
    this.messageHandlers.forEach(handler => handler(message.type, message.data));
  }

  private scheduleReconnect() {
    if (this.disposed) return;
    if (this.reconnectAttempts >= RECONNECT_RETRY_DELAYS.length) {
      this.notifyStatus('disconnected');
      return;
    }

    const delay = RECONNECT_RETRY_DELAYS[this.reconnectAttempts];
    this.notifyStatus('reconnecting');

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect(this.path, this.authToken).catch(() => {
        this.scheduleReconnect();
      });
    }, delay);
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.clearHeartbeatTimeout();
        this.sendRaw({ type: 'ping' });
        this.heartbeatTimeout = setTimeout(() => {
          // No pong received — connection is stale
          this.ws?.close(4000, 'Heartbeat timeout');
        }, HEARTBEAT_TIMEOUT);
      }
    }, HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.clearHeartbeatTimeout();
  }

  private clearHeartbeatTimeout() {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  private notifyStatus(status: SocketStatus, info?: SocketStatusInfo) {
    this.statusHandlers.forEach(h => h(status, info));
  }

  private failAllPending(error: Error) {
    this.pendingRequests.forEach(({ reject, timeout }) => {
      clearTimeout(timeout);
      reject(error);
    });
    this.pendingRequests.clear();
  }
}

export const socket = new SocketManager();
