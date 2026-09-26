import type { ConfigStore, ConfigStoreOptions } from './types';

/**
 * Creates the configuration store that merges defaults, providers and runtime changes.
 */
export function createConfigStore<C>(_options: ConfigStoreOptions<C>): ConfigStore<C> {
  throw new Error('The configuration store is not available. The config agent replaces this stub.');
}
