import type { ConfigDocument, ConfigProvider } from '../config/types';
import { isConfigDocument, toConfigDocument } from './document';

/** The part of the Web Storage API that {@link localStorageProvider} uses. */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/** The options for {@link localStorageProvider}. */
export interface LocalStorageProviderOptions {
  /** The storage key that holds the document. */
  readonly key: string;
  /** The storage area. The default is `window.localStorage`. */
  readonly storage?: StorageLike;
  /** The provider name. The default is `'local'`. */
  readonly name?: string;
}

const UNREADABLE = Symbol('unreadable');

function resolveStorage(storage: StorageLike | undefined): StorageLike | undefined {
  if (storage) return storage;
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

function parse(raw: string | null): unknown {
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return UNREADABLE;
  }
}

/**
 * Create a provider that keeps the configuration document in Web Storage.
 *
 * @remarks
 * Storage errors and JSON that is not valid give `null`. A value that is not a
 * configuration document makes `load` reject. Other tabs send changes through the
 * `storage` event.
 *
 * @param options - The storage key, the storage area and the provider name.
 * @returns A provider that can load, save and subscribe.
 * @example
 * ```ts
 * createWand({ providers: [localStorageProvider({ key: 'wand' })] });
 * ```
 */
export function localStorageProvider(options: LocalStorageProviderOptions): ConfigProvider {
  const { key } = options;
  const name = options.name ?? 'local';

  const read = (): unknown => {
    const storage = resolveStorage(options.storage);
    if (!storage) return null;
    try {
      return parse(storage.getItem(key));
    } catch {
      return null;
    }
  };

  return {
    name,

    async load() {
      const value = read();
      if (value === null || value === UNREADABLE) return null;
      return toConfigDocument(value, name);
    },

    async save(document) {
      const storage = resolveStorage(options.storage);
      if (!storage) {
        throw new Error(`The provider "${name}" cannot find a storage area.`);
      }
      try {
        storage.setItem(key, JSON.stringify(document));
      } catch (cause) {
        throw Object.assign(new Error(`The provider "${name}" cannot write the key "${key}".`), {
          cause,
        });
      }
    },

    subscribe(onChange) {
      if (typeof window === 'undefined') return () => {};
      const onStorage = (event: Event): void => {
        const { key: changedKey, storageArea, newValue } = event as StorageEvent;
        if (changedKey !== null && changedKey !== key) return;
        if (storageArea !== resolveStorage(options.storage)) return;
        const value = changedKey === null ? null : parse(newValue);
        if (value === null || value === UNREADABLE) onChange(null);
        else if (isConfigDocument(value)) onChange(value as ConfigDocument);
      };
      window.addEventListener('storage', onStorage);
      return () => window.removeEventListener('storage', onStorage);
    },
  };
}
