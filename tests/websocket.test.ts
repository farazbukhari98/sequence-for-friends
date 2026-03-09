import { SequenceWebSocket } from '../client/src/lib/websocket';

class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: MockWebSocket[] = [];

  readonly url: string;
  readyState = MockWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  sentMessages: string[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sentMessages.push(data);
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED;
  }

  emitOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  emitClose(): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  emitMessage(message: unknown): void {
    this.onmessage?.({ data: JSON.stringify(message) });
  }

  static reset(): void {
    MockWebSocket.instances = [];
  }
}

describe('SequenceWebSocket', () => {
  let originalWebSocket: typeof WebSocket | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    MockWebSocket.reset();
    originalWebSocket = globalThis.WebSocket;
    (globalThis as typeof globalThis & { WebSocket: typeof WebSocket }).WebSocket =
      MockWebSocket as unknown as typeof WebSocket;
  });

  afterEach(() => {
    vi.useRealTimers();
    if (originalWebSocket) {
      (globalThis as typeof globalThis & { WebSocket: typeof WebSocket }).WebSocket =
        originalWebSocket;
    } else {
      delete (globalThis as typeof globalThis & { WebSocket?: typeof WebSocket }).WebSocket;
    }
  });

  it('forceReconnect creates a single replacement socket', () => {
    const socket = new SequenceWebSocket('ws://initial');
    const initial = MockWebSocket.instances[0];
    initial.emitOpen();

    socket.forceReconnect();

    expect(MockWebSocket.instances).toHaveLength(2);

    initial.emitClose();
    vi.runOnlyPendingTimers();

    expect(MockWebSocket.instances).toHaveLength(2);

    socket.close();
  });

  it('stale close events do not schedule extra reconnect attempts', () => {
    const socket = new SequenceWebSocket('ws://initial');
    const initial = MockWebSocket.instances[0];
    initial.emitOpen();

    socket.forceReconnect();
    initial.emitClose();
    vi.advanceTimersByTime(30_000);

    expect(MockWebSocket.instances).toHaveLength(2);

    socket.close();
  });

  it('repeated close events keep only one reconnect timer pending', () => {
    const socket = new SequenceWebSocket('ws://initial');
    const initial = MockWebSocket.instances[0];
    initial.emitOpen();

    initial.emitClose();
    initial.emitClose();

    vi.advanceTimersByTime(1999);
    expect(MockWebSocket.instances).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(MockWebSocket.instances).toHaveLength(2);

    socket.close();
  });

  it('rejects pending requests once during forced reconnect', async () => {
    const socket = new SequenceWebSocket('ws://initial');
    const initial = MockWebSocket.instances[0];
    initial.emitOpen();

    const onReject = vi.fn();
    const pending = socket.request('ping').catch(onReject);

    socket.forceReconnect();
    await Promise.resolve();

    initial.emitClose();
    await Promise.resolve();

    expect(onReject).toHaveBeenCalledTimes(1);
    await pending;

    socket.close();
  });

  it('fires onReconnect only for the active replacement socket', () => {
    const socket = new SequenceWebSocket('ws://initial');
    const onReconnect = vi.fn();
    socket.onReconnect = onReconnect;

    const initial = MockWebSocket.instances[0];
    initial.emitOpen();

    socket.forceReconnect();
    const replacement = MockWebSocket.instances[1];

    initial.emitClose();
    replacement.emitOpen();

    expect(onReconnect).toHaveBeenCalledTimes(1);

    socket.close();
  });
});
