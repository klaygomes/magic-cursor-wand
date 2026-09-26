import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConfigDocument } from '../config/types';
import { httpProvider } from './http';

const url = 'https://example.test/wand.json';

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), init);
}

function fetchMock(...responses: (() => Response | Promise<Response>)[]) {
  return vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
    const next = responses.shift();
    if (!next) throw new Error('No more responses.');
    return next();
  });
}

function headerOf(init: RequestInit | undefined, name: string): string | undefined {
  return (init?.headers as Record<string, string> | undefined)?.[name];
}

describe('httpProvider load and save', () => {
  it('uses the default name and omits save and subscribe', () => {
    const provider = httpProvider({ url, fetch: fetchMock() });
    expect(provider.name).toBe('http');
    expect(provider.save).toBeUndefined();
    expect(provider.subscribe).toBeUndefined();
    expect(httpProvider({ url, name: 'api' }).name).toBe('api');
  });

  it('loads with a GET that honors the signal and the headers', async () => {
    const fetch = fetchMock(() => json({ v: 1, chalk: { size: 4 } }));
    const provider = httpProvider({ url, fetch, headers: { Authorization: 'Bearer t' } });
    const controller = new AbortController();
    await expect(provider.load(controller.signal)).resolves.toEqual({ v: 1, chalk: { size: 4 } });
    const [calledUrl, init] = fetch.mock.calls[0] ?? [];
    expect(calledUrl).toBe(url);
    expect(init?.method).toBe('GET');
    expect(init?.signal).toBe(controller.signal);
    expect(headerOf(init, 'Authorization')).toBe('Bearer t');
  });

  it('rejects when the signal aborts', async () => {
    const fetch = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
    );
    const provider = httpProvider({ url, fetch });
    const controller = new AbortController();
    const loading = provider.load(controller.signal);
    controller.abort(new Error('Stop.'));
    await expect(loading).rejects.toThrow('Stop.');
  });

  it('loads null for status 204', async () => {
    const provider = httpProvider({
      url,
      fetch: fetchMock(() => new Response(null, { status: 204 })),
    });
    await expect(provider.load(new AbortController().signal)).resolves.toBeNull();
  });

  it('rejects a status that is not 2xx with a clear message', async () => {
    const provider = httpProvider({ url, fetch: fetchMock(() => json({}, { status: 500 })) });
    await expect(provider.load(new AbortController().signal)).rejects.toThrow(
      `The provider "http" cannot load "${url}". The server sent status 500.`,
    );
  });

  it('rejects JSON and payloads that are not valid', async () => {
    const provider = httpProvider({
      url,
      fetch: fetchMock(
        () => new Response('{bad'),
        () => json({ chalk: {} }),
      ),
    });
    const { signal } = new AbortController();
    await expect(provider.load(signal)).rejects.toThrow(/JSON that is not valid/);
    await expect(provider.load(signal)).rejects.toThrow(/not valid/);
  });

  it.each(['PUT', 'POST'] as const)('saves JSON with %s', async (method) => {
    const fetch = fetchMock(() => new Response(null, { status: 204 }));
    const provider = httpProvider({ url, fetch, save: method, headers: { 'X-Key': 'a' } });
    const controller = new AbortController();
    await provider.save?.({ v: 1, glitter: { enabled: false } }, controller.signal);
    const [, init] = fetch.mock.calls[0] ?? [];
    expect(init?.method).toBe(method);
    expect(init?.body).toBe('{"v":1,"glitter":{"enabled":false}}');
    expect(init?.signal).toBe(controller.signal);
    expect(headerOf(init, 'Content-Type')).toBe('application/json');
    expect(headerOf(init, 'X-Key')).toBe('a');
  });

  it('rejects a save with a status that is not 2xx', async () => {
    const provider = httpProvider({
      url,
      save: 'PUT',
      fetch: fetchMock(() => new Response(null, { status: 403 })),
    });
    await expect(provider.save?.({ v: 1 }, new AbortController().signal)).rejects.toThrow(
      'The server sent status 403.',
    );
  });
});

describe('httpProvider polling', () => {
  let page: EventTarget & { hidden: boolean };

  beforeEach(() => {
    vi.useFakeTimers();
    page = Object.assign(new EventTarget(), { hidden: false });
    vi.stubGlobal('document', page);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('polls with If-None-Match and ignores 304', async () => {
    const fetch = fetchMock(
      () => json({ v: 1 }, { headers: { ETag: '"a"' } }),
      () => new Response(null, { status: 304 }),
      () => json({ v: 1, chalk: { size: 2 } }, { headers: { ETag: '"b"' } }),
    );
    const provider = httpProvider({ url, fetch, pollMs: 1000 });
    const changes: (ConfigDocument | null)[] = [];
    await provider.load(new AbortController().signal);
    const unsubscribe = provider.subscribe?.((document) => changes.push(document));

    await vi.advanceTimersByTimeAsync(1000);
    expect(headerOf(fetch.mock.calls[1]?.[1], 'If-None-Match')).toBe('"a"');
    expect(changes).toEqual([]);

    await vi.advanceTimersByTimeAsync(1000);
    expect(headerOf(fetch.mock.calls[2]?.[1], 'If-None-Match')).toBe('"a"');
    expect(changes).toEqual([{ v: 1, chalk: { size: 2 } }]);

    unsubscribe?.();
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('skips a 200 with the same body', async () => {
    const fetch = fetchMock(
      () => json({ v: 1 }),
      () => json({ v: 1 }),
    );
    const provider = httpProvider({ url, fetch, pollMs: 100 });
    const onChange = vi.fn();
    await provider.load(new AbortController().signal);
    const unsubscribe = provider.subscribe?.(onChange);
    await vi.advanceTimersByTimeAsync(100);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(onChange).not.toHaveBeenCalled();
    unsubscribe?.();
  });

  it('keeps polling after a failed poll', async () => {
    const fetch = fetchMock(
      () => json({}, { status: 503 }),
      () => json({ v: 2 }),
    );
    const provider = httpProvider({ url, fetch, pollMs: 100 });
    const onChange = vi.fn();
    const unsubscribe = provider.subscribe?.(onChange);
    await vi.advanceTimersByTimeAsync(200);
    expect(onChange).toHaveBeenCalledWith({ v: 2 });
    unsubscribe?.();
  });

  it('pauses while the document is hidden and polls again when visible', async () => {
    const fetch = fetchMock(
      () => json({ v: 1 }),
      () => json({ v: 2 }),
    );
    const provider = httpProvider({ url, fetch, pollMs: 100 });
    const onChange = vi.fn();
    const unsubscribe = provider.subscribe?.(onChange);

    page.hidden = true;
    page.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetch).not.toHaveBeenCalled();

    page.hidden = false;
    page.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith({ v: 1 });

    await vi.advanceTimersByTimeAsync(100);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith({ v: 2 });

    unsubscribe?.();
    page.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('aborts a poll in flight on unsubscribe', async () => {
    let pollSignal: AbortSignal | undefined;
    const fetch = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      pollSignal = init?.signal ?? undefined;
      return new Promise<Response>(() => {});
    });
    const provider = httpProvider({ url, fetch, pollMs: 100 });
    const unsubscribe = provider.subscribe?.(() => {});
    await vi.advanceTimersByTimeAsync(100);
    unsubscribe?.();
    expect(pollSignal?.aborted).toBe(true);
  });
});
