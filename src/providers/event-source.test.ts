import { describe, expect, it, vi } from 'vitest';
import type { ConfigDocument } from '../config/types';
import { type EventSourceLike, eventSourceProvider } from './event-source';

class FakeEventSource extends EventTarget implements EventSourceLike {
  static readonly instances: FakeEventSource[] = [];
  closed = false;

  constructor(
    readonly url: string,
    readonly init?: { withCredentials?: boolean },
  ) {
    super();
    FakeEventSource.instances.push(this);
  }

  close(): void {
    this.closed = true;
  }

  emit(data: string): void {
    this.dispatchEvent(Object.assign(new Event('message'), { data }));
  }

  fail(): void {
    this.dispatchEvent(new Event('error'));
  }
}

function setup(name?: string) {
  FakeEventSource.instances.length = 0;
  const provider = eventSourceProvider({
    url: '/stream',
    withCredentials: true,
    EventSource: FakeEventSource,
    ...(name === undefined ? {} : { name }),
  });
  const source = (): FakeEventSource => {
    const last = FakeEventSource.instances[FakeEventSource.instances.length - 1];
    if (!last) throw new Error('No source.');
    return last;
  };
  return { provider, source };
}

describe('eventSourceProvider', () => {
  it('uses the default name and has no save', () => {
    expect(setup().provider.name).toBe('sse');
    expect(setup('live').provider.name).toBe('live');
    expect(setup().provider.save).toBeUndefined();
  });

  it('loads the first message document with credentials', async () => {
    const { provider, source } = setup();
    const loading = provider.load(new AbortController().signal);
    expect(source().url).toBe('/stream');
    expect(source().init).toEqual({ withCredentials: true });
    source().emit('{"v":1,"chalk":{"size":5}}');
    source().emit('{"v":1,"chalk":{"size":6}}');
    await expect(loading).resolves.toEqual({ v: 1, chalk: { size: 5 } });
  });

  it('rejects the load for a payload that is not valid and closes the source', async () => {
    const { provider, source } = setup();
    const loading = provider.load(new AbortController().signal);
    source().emit('{"size":5}');
    await expect(loading).rejects.toThrow(/"sse".*not valid/);
    expect(source().closed).toBe(true);
  });

  it('rejects the load on a stream error before the first message', async () => {
    const { provider, source } = setup();
    const loading = provider.load(new AbortController().signal);
    source().fail();
    await expect(loading).rejects.toThrow(
      'The provider "sse" cannot read the event stream "/stream".',
    );
  });

  it('rejects the load and closes the source on abort', async () => {
    const { provider, source } = setup();
    const controller = new AbortController();
    const loading = provider.load(controller.signal);
    controller.abort(new Error('Stop.'));
    await expect(loading).rejects.toThrow('Stop.');
    expect(source().closed).toBe(true);
  });

  it('closes the source on abort after the load', async () => {
    const { provider, source } = setup();
    const controller = new AbortController();
    const loading = provider.load(controller.signal);
    source().emit('{"v":1}');
    await loading;
    expect(source().closed).toBe(false);
    controller.abort();
    expect(source().closed).toBe(true);
  });

  it('rejects at once for a signal that is already aborted', async () => {
    const { provider } = setup();
    const controller = new AbortController();
    controller.abort(new Error('Gone.'));
    await expect(provider.load(controller.signal)).rejects.toThrow('Gone.');
    expect(FakeEventSource.instances).toHaveLength(0);
  });

  it('delivers each valid message and shares one source', async () => {
    const { provider, source } = setup();
    const controller = new AbortController();
    const loading = provider.load(controller.signal);
    const first: (ConfigDocument | null)[] = [];
    const second = vi.fn();
    const stopFirst = provider.subscribe?.((document) => first.push(document));
    const stopSecond = provider.subscribe?.(second);
    expect(FakeEventSource.instances).toHaveLength(1);

    source().emit('{"v":1}');
    await loading;
    source().emit('not json');
    source().emit('{"v":1,"cloud":{"enabled":false}}');
    expect(first).toEqual([{ v: 1 }, { v: 1, cloud: { enabled: false } }]);
    expect(second).toHaveBeenCalledTimes(2);

    stopFirst?.();
    expect(source().closed).toBe(false);
    stopSecond?.();
    expect(source().closed).toBe(true);
  });

  it('sends a message that is not a valid document to the error handler', () => {
    const { provider, source } = setup();
    const onChange = vi.fn();
    const onError = vi.fn();
    const stop = provider.subscribe?.(onChange, onError);
    source().emit('not json');
    source().emit('{"size":5}');
    source().emit('{"v":1}');
    expect(onError).toHaveBeenCalledTimes(2);
    expect(String(onError.mock.calls[1]?.[0])).toMatch(/"sse".*not valid/);
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ v: 1 });
    stop?.();
  });

  it('opens a new source for a later subscriber', () => {
    const { provider } = setup();
    provider.subscribe?.(() => {})();
    const stop = provider.subscribe?.(() => {});
    expect(FakeEventSource.instances).toHaveLength(2);
    expect(FakeEventSource.instances[1]?.closed).toBe(false);
    stop?.();
  });

  it('rejects the load without an EventSource implementation', async () => {
    vi.stubGlobal('EventSource', undefined);
    const provider = eventSourceProvider({ url: '/stream' });
    await expect(provider.load(new AbortController().signal)).rejects.toThrow(
      /cannot find an EventSource/,
    );
    vi.unstubAllGlobals();
  });
});
