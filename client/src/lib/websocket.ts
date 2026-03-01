// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MessageHandler = (data: any) => void;

interface PendingRequest {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resolve: (data: any) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

/**
 * SequenceWebSocket - wraps native WebSocket with:
 * - Typed event listeners via on()/off()
 * - request() with correlation IDs for request/response pattern
 * - send() for fire-and-forget messages
 * - Auto-reconnect with exponential backoff (uses reconnectUrl if set)
 * - Connection lifecycle callbacks including onReconnect
 */
export class SequenceWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private _reconnectUrl: string | null = null;
  private handlers = new Map<string, Set<MessageHandler>>();
  private pendingRequests = new Map<string, PendingRequest>();
  private msgCounter = 0;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;
  private _connected = false;
  private hasConnectedOnce = false;

  // Lifecycle callbacks
  onOpen: (() => void) | null = null;
  onClose: (() => void) | null = null;
  onError: ((error: Event) => void) | null = null;
  /** Called when auto-reconnect succeeds (not on initial connect) */
  onReconnect: (() => void) | null = null;
  /** Called when all reconnect attempts are exhausted */
  onReconnectFailed: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    this.connect();
  }

  get connected(): boolean {
    return this._connected;
  }

  /** Set a different URL to use when auto-reconnecting */
  setReconnectUrl(url: string): void {
    this._reconnectUrl = url;
  }

  private connect(): void {
    const targetUrl = this.hasConnectedOnce && this._reconnectUrl
      ? this._reconnectUrl
      : this.url;

    try {
      this.ws = new WebSocket(targetUrl);
    } catch (e) {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this._connected = true;
      const isReconnect = this.hasConnectedOnce;
      this.hasConnectedOnce = true;
      this.reconnectAttempts = 0;

      if (isReconnect) {
        this.onReconnect?.();
      }
      this.onOpen?.();
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleMessage(msg);
      } catch {
        // Ignore malformed messages
      }
    };

    this.ws.onclose = () => {
      this._connected = false;
      this.onClose?.();

      // Reject all pending requests
      for (const [id, pending] of this.pendingRequests) {
        clearTimeout(pending.timeout);
        pending.reject(new Error('Connection closed'));
      }
      this.pendingRequests.clear();

      if (!this.intentionalClose) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (e) => {
      this.onError?.(e);
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handleMessage(msg: any): void {
    // Handle response to request()
    if (msg.type === 'response' && msg.id) {
      const pending = this.pendingRequests.get(msg.id);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(msg.id);
        pending.resolve(msg.data);
      }
      return;
    }

    // Handle broadcast/event messages
    const handlers = this.handlers.get(msg.type);
    if (handlers) {
      for (const handler of handlers) {
        handler(msg.data);
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.intentionalClose) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.onReconnectFailed?.();
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Register an event handler for a message type
   */
  on(type: string, handler: MessageHandler): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
  }

  /**
   * Remove an event handler
   */
  off(type: string, handler: MessageHandler): void {
    this.handlers.get(type)?.delete(handler);
  }

  /**
   * Send a fire-and-forget message
   */
  send(type: string, data?: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type, data }));
  }

  /**
   * Send a request and wait for a correlated response
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  request<T = any>(type: string, data?: unknown, timeoutMs = 10000): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected to server'));
        return;
      }

      const id = `msg_${++this.msgCounter}`;
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error('Request timeout'));
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timeout });
      this.ws.send(JSON.stringify({ type, id, data }));
    });
  }

  /**
   * Close the connection permanently (no reconnect)
   */
  close(): void {
    this.intentionalClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close(1000, 'Client closing');
      this.ws = null;
    }
    this._connected = false;

    // Clean up pending requests
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Connection closed'));
    }
    this.pendingRequests.clear();
  }
}
