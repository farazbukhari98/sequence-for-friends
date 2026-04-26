import { SocketManager } from '@/services/socket';

type MockCloseEvent = { code: number; reason: string; wasClean: boolean };

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];

  readyState = MockWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onclose: ((event: MockCloseEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
  }

  send() {}

  close(code = 1000, reason = 'Client disconnect') {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code, reason, wasClean: code === 1000 });
  }

  open() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }
}

describe('SocketManager', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    (globalThis as any).WebSocket = MockWebSocket;
  });

  it('rejects requests immediately when disconnected', async () => {
    const manager = new SocketManager();

    await expect(manager.request('create-room')).rejects.toThrow('Socket is not connected');
  });

  it('ignores stale close events from a superseded socket', async () => {
    const manager = new SocketManager();

    const firstConnect = manager.connect('/ws/create');
    const firstSocket = MockWebSocket.instances[0];
    firstSocket.open();
    await firstConnect;

    const secondConnect = manager.connect('/ws/create');
    const secondSocket = MockWebSocket.instances[1];
    secondSocket.open();
    await secondConnect;

    firstSocket.onclose?.({ code: 4000, reason: 'stale close', wasClean: false });

    expect(manager.isConnected).toBe(true);
    manager.disconnect();
  });
});
