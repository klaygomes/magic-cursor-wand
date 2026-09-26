import type { ConfigDocument, ConfigProvider } from '../config/types';
import { toConfigDocument } from './document';

/**
 * Create a provider that returns a fixed configuration document.
 *
 * @param document - The document that `load` returns.
 * @param name - The provider name. The default is `'static'`.
 * @returns A read-only provider.
 * @example
 * ```ts
 * createWand({ providers: [staticProvider({ v: 1, chalk: { size: 20 } })] });
 * ```
 */
export function staticProvider(document: ConfigDocument, name = 'static'): ConfigProvider {
  return {
    name,
    load: async () => toConfigDocument(document, name),
  };
}
