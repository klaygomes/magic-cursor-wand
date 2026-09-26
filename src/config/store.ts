import { field } from './field';
import { migrateDocument } from './migrations';
import { cloneData, deepEqual, hasOwn, isRecord, ownEntries, type PlainRecord } from './object';
import { theme } from './theme';
import {
  type BooleanField,
  CONFIG_VERSION,
  type ConfigDocument,
  type ConfigPatch,
  type ConfigProvider,
  type ConfigStore,
  type ConfigStoreOptions,
  type Field,
  type Resolved,
  type SaveOptions,
  type Section,
  type ThemeConfig,
  type WandError,
  type WandErrorKind,
} from './types';

type Layer = Record<string, PlainRecord>;

const DEFAULT_AUTOSAVE_DEBOUNCE_MS = 500;

const enabledField: BooleanField = field.boolean({
  label: 'Enabled',
  description: 'Turn the section on or off.',
  default: true,
});

function composeSections(sections: readonly Section[]): Section[] {
  const composed = new Map<string, Section>([[theme.name, theme]]);
  for (const section of sections) {
    if (section.name === theme.name) continue;
    composed.set(section.name, {
      name: section.name,
      schema: { enabled: enabledField, ...section.schema },
    });
  }
  return [...composed.values()];
}

function mergeLayers(layers: readonly Layer[]): Layer {
  const merged: Layer = {};
  for (const layer of layers) {
    for (const [name, values] of Object.entries(layer))
      merged[name] = { ...merged[name], ...values };
  }
  return merged;
}

function diffLayers(full: Layer, base: Layer): Layer {
  const diff: Layer = {};
  for (const [name, values] of Object.entries(full)) {
    const baseValues = base[name] ?? {};
    for (const [key, value] of Object.entries(values)) {
      const inBase = hasOwn(baseValues, key);
      if (inBase && deepEqual(value, baseValues[key])) continue;
      diff[name] = { ...diff[name], [key]: value };
    }
  }
  return diff;
}

function withoutUnchanged(current: Layer, snapshot: Layer): Layer {
  const remaining: Layer = {};
  for (const [name, values] of Object.entries(current)) {
    const saved = snapshot[name] ?? {};
    for (const [key, value] of Object.entries(values)) {
      const unchanged = hasOwn(saved, key) && deepEqual(value, saved[key]);
      if (!unchanged) remaining[name] = { ...remaining[name], [key]: value };
    }
  }
  return remaining;
}

function sameValues(a: Layer, b: Layer): boolean {
  const names = Object.keys(a);
  if (names.length !== Object.keys(b).length) return false;
  return names.every((name) => {
    const left = a[name];
    const right = b[name];
    return left !== undefined && right !== undefined && deepEqual(left, right);
  });
}

function toDocument(layer: Layer): ConfigDocument {
  return { ...cloneData(layer), v: CONFIG_VERSION };
}

/**
 * Replaces each `null` value with the theme color, so that an effect gets only resolved values.
 *
 * @param values - The values of one section.
 * @param themeConfig - The theme values.
 * @returns A copy of the values without `null`.
 * @example
 * const config = resolveSection(store.get().glitter, store.get().theme);
 */
export function resolveSection<T extends object>(values: T, themeConfig: ThemeConfig): Resolved<T> {
  const resolved: PlainRecord = {};
  for (const [key, value] of Object.entries(values))
    resolved[key] = value === null ? themeConfig.color : value;
  return resolved as Resolved<T>;
}

/**
 * Creates the configuration store that merges defaults, providers and runtime changes.
 *
 * @param options - The sections, the defaults, the providers and the store settings.
 * @returns The configuration store.
 * @example
 * const store = createConfigStore({ sections: [chalkEffect()], providers: [localStorageProvider({ key: 'wand' })] });
 * store.set({ chalk: { size: 20 } });
 */
export function createConfigStore<C>(options: ConfigStoreOptions<C>): ConfigStore<C> {
  const sections = composeSections(options.sections);
  const schemas = new Map<string, Map<string, Field>>(
    sections.map((section) => [section.name, new Map(Object.entries(section.schema))]),
  );
  const providers = options.providers ?? [];
  const locked = new Set(options.locked ?? []);
  const debounceMs = options.autosaveDebounceMs ?? DEFAULT_AUTOSAVE_DEBOUNCE_MS;
  const controller = new AbortController();
  const listeners = new Set<(next: C, previous: C) => void>();

  let destroyed = false;
  let autosaveTimer: ReturnType<typeof setTimeout> | undefined;
  let saveQueue: Promise<void> = Promise.resolve();

  function report(kind: WandErrorKind, source: string, message: string, cause?: unknown): void {
    if (!options.onError) return;
    const error: WandError =
      cause === undefined ? { kind, source, message } : { kind, source, message, cause };
    options.onError(error);
  }

  function readLayer(input: unknown, source: string, stripLocked: boolean): Layer {
    const layer: Layer = {};
    if (!isRecord(input)) return layer;
    for (const [name, raw] of ownEntries(input)) {
      if (name === 'v') continue;
      const schema = schemas.get(name);
      if (!isRecord(raw)) {
        report(
          'validation',
          source,
          `The section "${name}" is not an object. The store ignores it.`,
        );
        continue;
      }
      const values: PlainRecord = {};
      for (const [key, value] of ownEntries(raw)) {
        const path = `${name}.${key}`;
        if (stripLocked && locked.has(path)) continue;
        if (!schema) {
          values[key] = cloneData(value);
          continue;
        }
        const definition = schema.get(key);
        if (!definition) continue;
        const parsed = definition.parse(value);
        if (parsed === undefined) {
          report(
            'validation',
            source,
            `The value of "${path}" is not valid. The store ignores it.`,
            value,
          );
          continue;
        }
        values[key] = parsed;
      }
      if (Object.keys(values).length > 0) layer[name] = values;
    }
    return layer;
  }

  function readDocument(input: unknown, source: string): Layer | undefined {
    const result = migrateDocument(input);
    if (!result.ok) {
      report(
        'validation',
        source,
        `${result.message} The store ignores the document.`,
        result.cause,
      );
      return undefined;
    }
    return readLayer(result.document, source, true);
  }

  const defaultsLayer: Layer = {};
  for (const section of sections) {
    const values: PlainRecord = {};
    for (const [key, definition] of Object.entries(section.schema))
      values[key] = definition.default;
    defaultsLayer[section.name] = values;
  }
  const configLayer = readLayer(options.defaults, 'config', false);
  const slots: Layer[] = providers.map(() => ({}));
  const subscribed: boolean[] = providers.map(() => false);
  let runtime: Layer = {};

  function layersBelow(index: number): Layer[] {
    return [defaultsLayer, configLayer, ...slots.slice(0, index)];
  }

  function mergeAll(): Layer {
    return mergeLayers([...layersBelow(slots.length), runtime]);
  }

  function knownValues(merged: Layer): Layer {
    const known: Layer = {};
    for (const section of sections) known[section.name] = merged[section.name] ?? {};
    return known;
  }

  let current = knownValues(mergeAll());

  function recompute(): void {
    const next = knownValues(mergeAll());
    if (sameValues(next, current)) return;
    const previous = current;
    current = next;
    for (const listener of [...listeners]) listener(next as C, previous as C);
  }

  function targetIndex(to: string | undefined): number {
    for (let index = providers.length - 1; index >= 0; index -= 1) {
      const provider = providers[index];
      if (!provider?.save) continue;
      if (to === undefined || provider.name === to) return index;
    }
    return -1;
  }

  function cancelAutosave(): void {
    if (autosaveTimer === undefined) return;
    clearTimeout(autosaveTimer);
    autosaveTimer = undefined;
  }

  function scheduleAutosave(): void {
    cancelAutosave();
    autosaveTimer = setTimeout(() => {
      autosaveTimer = undefined;
      void enqueue(() => performSave(undefined));
    }, debounceMs);
  }

  function enqueue(task: () => Promise<void>): Promise<void> {
    const run = saveQueue.then(task).catch((cause: unknown) => {
      report('provider', 'store', 'The save operation failed.', cause);
    });
    saveQueue = run;
    return run;
  }

  async function writeTo(provider: ConfigProvider, document: ConfigDocument): Promise<boolean> {
    try {
      await provider.save?.(document, controller.signal);
      return true;
    } catch (cause) {
      if (!destroyed)
        report(
          'provider',
          provider.name,
          `The provider "${provider.name}" cannot save the configuration.`,
          cause,
        );
      return false;
    }
  }

  async function performSave(to: string | undefined): Promise<void> {
    await ready;
    if (destroyed) return;
    const index = targetIndex(to);
    const provider = providers[index];
    if (!provider) {
      if (to !== undefined)
        report('provider', to, `No provider with the name "${to}" can save the configuration.`);
      return;
    }
    const snapshot = runtime;
    const diff = diffLayers(mergeAll(), mergeLayers(layersBelow(index)));
    if (!(await writeTo(provider, toDocument(diff))) || destroyed) return;
    slots[index] = diff;
    runtime = withoutUnchanged(runtime, snapshot);
    recompute();
  }

  async function performReset(): Promise<void> {
    await ready;
    if (destroyed) return;
    const index = targetIndex(undefined);
    const provider = providers[index];
    if (!provider) return;
    slots[index] = {};
    recompute();
    await writeTo(provider, { v: CONFIG_VERSION });
  }

  function applyRuntime(layer: Layer): void {
    runtime = mergeLayers([runtime, layer]);
    recompute();
    scheduleAutosave();
  }

  const unsubscribers: (() => void)[] = [];
  const loads = providers.map((provider, index) => {
    let pending: Promise<ConfigDocument | null>;
    try {
      pending = Promise.resolve(provider.load(controller.signal));
    } catch (cause) {
      pending = Promise.reject(cause);
    }
    return pending.then(
      (document) => {
        if (destroyed || subscribed[index]) return;
        const layer = document === null ? {} : readDocument(document, provider.name);
        if (!layer) return;
        slots[index] = layer;
        recompute();
      },
      (cause: unknown) => {
        if (!destroyed)
          report(
            'provider',
            provider.name,
            `The provider "${provider.name}" cannot load the configuration.`,
            cause,
          );
      },
    );
  });
  const ready: Promise<void> = Promise.all(loads).then(
    () => undefined,
    () => undefined,
  );

  providers.forEach((provider, index) => {
    if (!provider.subscribe) return;
    try {
      unsubscribers.push(
        provider.subscribe((document) => {
          if (destroyed) return;
          const layer = document === null ? {} : readDocument(document, provider.name);
          if (!layer) return;
          subscribed[index] = true;
          slots[index] = layer;
          recompute();
        }),
      );
    } catch (cause) {
      report(
        'provider',
        provider.name,
        `The provider "${provider.name}" cannot watch the configuration.`,
        cause,
      );
    }
  });

  return {
    ready,
    sections,
    get: () => current as C,
    set(patch: ConfigPatch<C>): void {
      if (destroyed) return;
      applyRuntime(readLayer(patch, 'setConfig', true));
    },
    reset(): void {
      if (destroyed) return;
      cancelAutosave();
      runtime = {};
      const index = targetIndex(undefined);
      if (index !== -1) slots[index] = {};
      recompute();
      void enqueue(performReset);
    },
    save(saveOptions?: SaveOptions): Promise<void> {
      if (destroyed) return Promise.resolve();
      cancelAutosave();
      return enqueue(() => performSave(saveOptions?.to));
    },
    export: () => toDocument(mergeAll()),
    import(document: unknown): void {
      if (destroyed) return;
      const layer = readDocument(document, 'import');
      if (layer) applyRuntime(layer);
    },
    subscribe(listener: (next: C, previous: C) => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      cancelAutosave();
      controller.abort();
      for (const unsubscribe of unsubscribers) unsubscribe();
      listeners.clear();
    },
  };
}
