import type { ConfigDocument, ConfigPatch, Section } from '../config/types';
import type { Wand, WandLifecycleEvents } from '../core/types';

/** A configuration with sections of plain values. */
export type FakeConfig = Record<string, Record<string, unknown>>;

/** A wand for tests that keeps the configuration in memory. */
export interface FakeWand extends Wand<FakeConfig> {
  readonly patches: ConfigPatch<FakeConfig>[];
  readonly imported: unknown[];
  readonly resets: number;
  readonly listenerCount: number;
  replaceConfig(next: FakeConfig): void;
}

function clone(config: FakeConfig): FakeConfig {
  return Object.fromEntries(Object.entries(config).map(([name, values]) => [name, { ...values }]));
}

/**
 * Create a wand for tests. The wand has no engine. It keeps the configuration and emits `config` events.
 *
 * @param sections - The sections of the wand.
 * @param initial - The initial configuration.
 * @returns The fake wand.
 */
export function createFakeWand(sections: readonly Section[], initial: FakeConfig): FakeWand {
  const defaults = clone(initial);
  let config = clone(initial);
  let resets = 0;
  const patches: ConfigPatch<FakeConfig>[] = [];
  const imported: unknown[] = [];
  const listeners = new Set<(payload: WandLifecycleEvents<FakeConfig>['config']) => void>();

  const replace = (next: FakeConfig): void => {
    const previous = config;
    config = next;
    for (const listener of Array.from(listeners)) listener({ next, previous });
  };

  const merge = (patch: Record<string, unknown>): void => {
    const next = clone(config);
    for (const [name, values] of Object.entries(patch)) {
      if (typeof values === 'object' && values !== null) {
        next[name] = { ...next[name], ...(values as Record<string, unknown>) };
      }
    }
    replace(next);
  };

  return {
    ready: Promise.resolve(),
    sections,
    patches,
    imported,
    get resets() {
      return resets;
    },
    get listenerCount() {
      return listeners.size;
    },
    getConfig: () => config,
    setConfig(patch) {
      patches.push(patch);
      merge(patch);
    },
    reset() {
      resets += 1;
      replace(clone(defaults));
    },
    save: () => Promise.resolve(),
    exportConfig: (): ConfigDocument => ({ v: 1, ...config }),
    importConfig(document) {
      imported.push(document);
      if (typeof document === 'object' && document !== null) {
        const { v: _version, ...sections } = document as Record<string, unknown>;
        merge(sections);
      }
    },
    on(type, handler) {
      if (type !== 'config') return () => {};
      const listener = handler as (payload: WandLifecycleEvents<FakeConfig>['config']) => void;
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    replaceConfig: replace,
    start() {},
    stop() {},
    destroy() {
      listeners.clear();
    },
  };
}
