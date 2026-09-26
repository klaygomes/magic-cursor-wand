import type { ConfigDocument, ConfigProvider } from '../config/types';
import { mergeDocuments } from './document';

/**
 * Create a provider that combines other providers into one provider.
 *
 * @remarks
 * `load` merges the child documents in order, section by section and field by field.
 * A later child overrides an earlier child. `load` rejects only when all children reject.
 * `save` sends the document to each child that can save.
 *
 * @param name - The provider name.
 * @param providers - The child providers, from low to high precedence.
 * @returns A provider that can load and, as the children permit, save and subscribe.
 * @example
 * ```ts
 * compositeProvider('remote', [
 *   httpProvider({ url: '/defaults.json' }),
 *   httpProvider({ url: '/api/wand', save: 'PUT' }),
 * ]);
 * ```
 */
export function compositeProvider(
  name: string,
  providers: readonly ConfigProvider[],
): ConfigProvider {
  const slots: (ConfigDocument | null)[] = providers.map(() => null);
  const merged = (): ConfigDocument | null =>
    mergeDocuments(slots.filter((slot): slot is ConfigDocument => slot !== null));

  const provider: ConfigProvider = {
    name,
    async load(signal) {
      const results = await Promise.allSettled(providers.map((child) => child.load(signal)));
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') slots[index] = result.value;
      });
      const [first] = results;
      if (first?.status === 'rejected' && results.every((r) => r.status === 'rejected')) {
        throw first.reason;
      }
      return merged();
    },
  };

  const writable = providers.filter((child) => child.save !== undefined);
  if (writable.length > 0) {
    provider.save = async (document, signal) => {
      await Promise.all(writable.map((child) => child.save?.(document, signal)));
    };
  }

  const observable = providers.filter((child) => child.subscribe !== undefined);
  if (observable.length > 0) {
    provider.subscribe = (onChange) => {
      const unsubscribers = providers.map(
        (child, index) =>
          child.subscribe?.((document) => {
            slots[index] = document;
            onChange(merged());
          }) ?? (() => {}),
      );
      return () => {
        for (const unsubscribe of unsubscribers) unsubscribe();
      };
    };
  }

  return provider;
}
