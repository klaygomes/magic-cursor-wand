import type { ConfigDocument, ConfigProvider } from '../config/types';
import { toConfigDocument } from './document';

/** The part of the `EventSource` API that {@link eventSourceProvider} uses. */
export interface EventSourceLike {
  addEventListener(type: 'message' | 'error', listener: (event: Event) => void): void;
  removeEventListener(type: 'message' | 'error', listener: (event: Event) => void): void;
  close(): void;
}

/** A constructor that is compatible with `EventSource`. */
export type EventSourceConstructor = new (
  url: string,
  init?: { withCredentials?: boolean },
) => EventSourceLike;

/** The options for {@link eventSourceProvider}. */
export interface EventSourceProviderOptions {
  /** The URL of the event stream. */
  readonly url: string;
  /** Send cookies with the request. The default is `false`. */
  readonly withCredentials?: boolean;
  /** The `EventSource` constructor. The default is `globalThis.EventSource`. */
  readonly EventSource?: EventSourceConstructor;
  /** The provider name. The default is `'sse'`. */
  readonly name?: string;
}

type Parsed = { ok: true; document: ConfigDocument } | { ok: false; error: unknown };

/**
 * Create a provider that gets the configuration document from a server-sent event stream.
 *
 * @remarks
 * Each message contains a full document. `load` resolves with the first message.
 * The provider closes the stream when the last subscriber leaves or when the `load`
 * signal aborts.
 *
 * @param options - The URL, the credentials mode and the provider name.
 * @returns A provider that can load and subscribe.
 * @example
 * ```ts
 * eventSourceProvider({ url: '/api/wand/stream', withCredentials: true });
 * ```
 */
export function eventSourceProvider(options: EventSourceProviderOptions): ConfigProvider {
  const { url } = options;
  const name = options.name ?? 'sse';
  const subscribers = new Set<(document: ConfigDocument | null) => void>();
  const waiters = new Set<(parsed: Parsed) => void>();
  let source: EventSourceLike | undefined;

  const parse = (data: unknown): Parsed => {
    try {
      return { ok: true, document: toConfigDocument(JSON.parse(String(data)), name) };
    } catch (error) {
      return { ok: false, error };
    }
  };

  const onMessage = (event: Event): void => {
    const parsed = parse((event as MessageEvent).data);
    for (const waiter of [...waiters]) waiter(parsed);
    if (!parsed.ok) return;
    for (const subscriber of [...subscribers]) subscriber(parsed.document);
  };

  const onError = (): void => {
    const error = new Error(`The provider "${name}" cannot read the event stream "${url}".`);
    for (const waiter of [...waiters]) waiter({ ok: false, error });
  };

  const open = (): void => {
    if (source) return;
    const Constructor = options.EventSource ?? globalThis.EventSource;
    if (!Constructor) {
      throw new Error(`The provider "${name}" cannot find an EventSource implementation.`);
    }
    source = new Constructor(url, { withCredentials: options.withCredentials ?? false });
    source.addEventListener('message', onMessage);
    source.addEventListener('error', onError);
  };

  const close = (): void => {
    if (!source || subscribers.size > 0 || waiters.size > 0) return;
    source.removeEventListener('message', onMessage);
    source.removeEventListener('error', onError);
    source.close();
    source = undefined;
  };

  return {
    name,

    load(signal) {
      return new Promise<ConfigDocument | null>((resolve, reject) => {
        if (signal.aborted) {
          reject(signal.reason);
          return;
        }
        const onAbort = (): void => {
          waiters.delete(waiter);
          reject(signal.reason);
          close();
        };
        const waiter = (parsed: Parsed): void => {
          waiters.delete(waiter);
          if (parsed.ok) {
            resolve(parsed.document);
          } else {
            signal.removeEventListener('abort', onAbort);
            reject(parsed.error);
            close();
          }
        };
        waiters.add(waiter);
        signal.addEventListener('abort', onAbort, { once: true });
        try {
          open();
        } catch (error) {
          waiters.delete(waiter);
          signal.removeEventListener('abort', onAbort);
          reject(error);
        }
      });
    },

    subscribe(onChange) {
      const subscriber = (document: ConfigDocument | null): void => onChange(document);
      subscribers.add(subscriber);
      try {
        open();
      } catch {
        subscribers.delete(subscriber);
        return () => {};
      }
      return () => {
        subscribers.delete(subscriber);
        close();
      };
    },
  };
}
