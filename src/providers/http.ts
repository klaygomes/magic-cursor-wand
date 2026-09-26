import type { ConfigDocument, ConfigProvider } from '../config/types';
import { toConfigDocument } from './document';

/** The options for {@link httpProvider}. */
export interface HttpProviderOptions {
  /** The URL of the configuration document. */
  readonly url: string;
  /** Static headers for each request. */
  readonly headers?: Readonly<Record<string, string>>;
  /** The interval between two polls in milliseconds. Without this value, the provider does not poll. */
  readonly pollMs?: number;
  /** The HTTP method for `save`. Without this value, the provider is read-only. */
  readonly save?: 'PUT' | 'POST' | false;
  /** The fetch function. The default is `globalThis.fetch`. */
  readonly fetch?: typeof fetch;
  /** The provider name. The default is `'http'`. */
  readonly name?: string;
}

interface Snapshot {
  etag: string | null;
  body: string | null;
}

function isHidden(): boolean {
  return typeof document !== 'undefined' && document.hidden;
}

/**
 * Create a provider that gets the configuration document from an HTTP endpoint.
 *
 * @remarks
 * A poll sends `If-None-Match` with the last ETag. The status 304 means no change.
 * The provider does not poll while `document.hidden` is true. A status that is not
 * 2xx makes the request reject.
 *
 * @param options - The URL, the headers, the poll interval and the save method.
 * @returns A provider that can load and, as configured, save and subscribe.
 * @example
 * ```ts
 * httpProvider({ url: '/api/wand', pollMs: 30_000, save: 'PUT' });
 * ```
 */
export function httpProvider(options: HttpProviderOptions): ConfigProvider {
  const { url, pollMs } = options;
  const name = options.name ?? 'http';
  const method = options.save;
  const snapshot: Snapshot = { etag: null, body: null };

  const request = (init: RequestInit): Promise<Response> => {
    const fetchImpl = options.fetch ?? globalThis.fetch;
    return fetchImpl(url, init);
  };

  const headers = (extra: Record<string, string>): Record<string, string> => ({
    Accept: 'application/json',
    ...options.headers,
    ...extra,
  });

  const assertOk = (response: Response, action: string): void => {
    if (!response.ok) {
      throw new Error(
        `The provider "${name}" cannot ${action} "${url}". The server sent status ${response.status}.`,
      );
    }
  };

  const readDocument = async (response: Response): Promise<ConfigDocument | null> => {
    snapshot.etag = response.headers.get('ETag');
    if (response.status === 204) {
      snapshot.body = '';
      return null;
    }
    const body = await response.text();
    snapshot.body = body;
    let value: unknown;
    try {
      value = JSON.parse(body);
    } catch {
      throw new Error(`The provider "${name}" received JSON that is not valid from "${url}".`);
    }
    return toConfigDocument(value, name);
  };

  const provider: ConfigProvider = {
    name,
    async load(signal) {
      const response = await request({ method: 'GET', headers: headers({}), signal });
      assertOk(response, 'load');
      return readDocument(response);
    },
  };

  if (method) {
    provider.save = async (document, signal) => {
      const response = await request({
        method,
        headers: headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(document),
        signal,
      });
      assertOk(response, 'save to');
      const etag = response.headers.get('ETag');
      if (etag !== null) snapshot.etag = etag;
    };
  }

  if (pollMs !== undefined && pollMs > 0) {
    provider.subscribe = (onChange) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      let controller: AbortController | undefined;
      let active = true;

      const schedule = (): void => {
        if (active && !isHidden()) timer = setTimeout(poll, pollMs);
      };

      const poll = async (): Promise<void> => {
        timer = undefined;
        controller = new AbortController();
        try {
          const extra: Record<string, string> =
            snapshot.etag === null ? {} : { 'If-None-Match': snapshot.etag };
          const response = await request({
            method: 'GET',
            headers: headers(extra),
            signal: controller.signal,
          });
          if (response.status !== 304) {
            assertOk(response, 'load');
            const previousBody = snapshot.body;
            const next = await readDocument(response);
            if (active && snapshot.body !== previousBody) onChange(next);
          }
        } catch {
          // A failed poll keeps the last document. The next poll tries again.
        } finally {
          controller = undefined;
          schedule();
        }
      };

      const onVisibilityChange = (): void => {
        if (isHidden()) {
          clearTimeout(timer);
          timer = undefined;
        } else if (timer === undefined && controller === undefined) {
          void poll();
        }
      };

      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', onVisibilityChange);
      }
      schedule();

      return () => {
        active = false;
        clearTimeout(timer);
        controller?.abort();
        if (typeof document !== 'undefined') {
          document.removeEventListener('visibilitychange', onVisibilityChange);
        }
      };
    };
  }

  return provider;
}
