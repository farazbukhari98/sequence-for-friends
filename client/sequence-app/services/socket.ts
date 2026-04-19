import { WS_BASE_URL, RECONNECT_RETRY_DELAYS, HEARTBEAT_INTERVAL, HEARTBEAT_TIMEOUT } from '@/constants/api';
import type { RoomSession } from '@/types/game';

type MessageHandler = (type: string, data: any) => void;
type StatusHandler = (status: 'connected' | 'disconnected' | 'connecting' | 'reconnecting') => void;

export class SocketManager {
  private ws: WebSocket | null = null;
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
  private storedSession: RoomSession | null = null;

  // Public session storage for reconnection
  setSession(session: RoomSession | null) {
    this.storedSession = session;
  }

  getSession(): RoomSession | null {
    return this.storedSession;
  }

  connect(path: string, authToken?: string): Promise<void> {
    this.disconnect();
    this.path = path;
    this.authToken = authToken ?? '';
    this.disposed = false;
    this.reconnectAttempts = 0;

    return new Promise((resolve, reject) => {
      try {
        const url = `${WS_BASE_URL}${path}${this.authToken ? `?token=${encodeURIComponent(this.authToken)}` : ''}`;
        const ws = new WebSocket(url);

        ws.onopen = () => {
          this.ws = ws;
          this.startHeartbeat();
          this.notifyStatus('connected');
          resolve();
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (e) {
            console.warn('Failed to parse WebSocket message:', e);
          }
        };

        ws.onclose = (event) => {
          this.ws = null;
          this.stopHeartbeat();
          this.notifyStatus('disconnected');
          if (!this.disposed && !event.wasClean) {
            this.scheduleReconnect();
          }
        };

        ws.onerror = () => {
          this.notifyStatus('disconnected');
          if (!this.ws) {
            reject(new Error('Failed to connect'));
          }
        };

        this.notifyStatus('connecting');
      } catch (err) {
        reject(err);
      }
    });
  }

  disconnect() {
    this.disposed = true;
    this.clearReconnectTimer();
    this.stopHeartbeat();
    this.failAllPending(new Error('Disconnected'));
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.notifyStatus('disconnected');
  }

  request(type: string, data?: any, timeoutMs: number = 10000): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = String(++this.requestIdCounter);
      const message = { type, ...(data || {}), _requestId: id };

      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${type}`));
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timeout: timer });
      this.sendRaw(message);
    });
  }

  send(type: string, data?: any) {
    this.sendRaw({ type, ...(data || {}) });
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
    if (message._responseId) {
      const pending = this.pendingRequests.get(message._responseId);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(message._responseId);
        if (message.error) {
          pending.reject(new Error(message.error));
        } else {
          pending.resolve(message);
        }
      }
      return;
    }

    // Notify message handlers
    const { type, _requestId, ...data } = message;
    this.messageHandlers.forEach(handler => handler(type || message.type, data));

    // If this is a response to a request (has _requestId matching), that was already handled above
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

  private notifyStatus(status: 'connected' | 'disconnected' | 'connecting' | 'reconnecting') {
    this.statusHandlers.forEach(h => h(status));
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