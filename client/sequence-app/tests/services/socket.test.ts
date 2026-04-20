import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { SocketManager } from '@/services/socket';

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static OPEN = 1;

  readyState = MockWebSocket.OPEN;
  sentMessages: string[] = [];
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { wasClean: boolean }) => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(payload: string) {
    this.sentMessages.push(payload);
  }

  close() {
    this.readyState = 3;
  }

  open() {
    this.onopen?.();
  }

  message(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }

  drop(wasClean = false) {
    this.readyState = 3;
    this.onclose?.({ wasClean });
  }
}

describe('SocketManager', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('wraps requests with auth in the query string and resolves response payloads', async () => {
    const socket = new SocketManager();
    const connectPromise = socket.connect('/ws/create', 'token-123');
    const ws = MockWebSocket.instances[0]!;

    expect(ws.url).toBe('wss://sequence-for-friends.farazbukhari98.workers.dev/ws/create?auth=token-123');

    ws.open();
    await connectPromise;

    const responsePromise = socket.request('create-room', { roomName: 'Friends' });
    expect(ws.sentMessages).toHaveLength(1);
    expect(JSON.parse(ws.sentMessages[0]!)).toEqual({
      type: 'create-room',
      id: '1',
      data: { roomName: 'Friends' },
    });

    ws.message({
      type: 'response',
      id: '1',
      data: { success: true, roomCode: 'ABCD' },
    });

    await expect(responsePromise).resolves.toEqual({ success: true, roomCode: 'ABCD' });
  });

  it('keeps message handlers registered across automatic reconnects', async () => {
    const socket = new SocketManager();
    const received: Array<{ type: string; data: unknown }> = [];

    socket.onMessage((type, data) => {
      received.push({ type, data });
    });

    const connectPromise = socket.connect('/ws/room/ABCD');
    const firstWs = MockWebSocket.instances[0]!;
    firstWs.open();
    await connectPromise;

    firstWs.drop(false);
    await vi.runOnlyPendingTimersAsync();

    const secondWs = MockWebSocket.instances[1]!;
    secondWs.open();
    secondWs.message({ type: 'room-updated', data: { code: 'ABCD' } });

    expect(received).toEqual([{ type: 'room-updated', data: { code: 'ABCD' } }]);
  });
});
