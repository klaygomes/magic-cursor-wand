import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { field } from './field';
import { createConfigStore, resolveSection } from './store';
import type {
  ComposeConfig,
  ConfigDocument,
  ConfigProvider,
  ConfigStoreOptions,
  Section,
  WandError,
} from './types';

const meta = { label: 'Label', description: 'The description.' };

const chalk = {
  name: 'chalk' as const,
  schema: {
    size: field.number({ ...meta, default: 15, min: 1, max: 50, step: 1 }),
    color: field.color({ ...meta, default: null, nullable: true }),
  },
} satisfies Section;

const glitter = {
  name: 'glitter' as const,
  schema: {
    maxParticles: field.number({ ...meta, default: 300, min: 0, max: 1000, step: 1 }),
  },
} satisfies Section;

type Config = ComposeConfig<[typeof chalk, typeof glitter]>;

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: unknown): void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

interface FakeProvider extends ConfigProvider {
  readonly saved: ConfigDocument[];
  readonly signals: AbortSignal[];
  emit(document: ConfigDocument | null): void;
  fail(error: unknown): void;
  failNextSave(): void;
}

interface FakeOptions {
  readonly document?: ConfigDocument | null;
  readonly load?: Deferred<ConfigDocument | null>;
  readonly writable?: boolean;
  readonly watch?: boolean;
  readonly saveGate?: () => Promise<void>;
}

function fakeProvider(name: string, options: FakeOptions = {}): FakeProvider {
  const saved: ConfigDocument[] = [];
  const signals: AbortSignal[] = [];
  let listener: ((document: ConfigDocument | null) => void) | undefined;
  let errorListener: ((error: unknown) => void) | undefined;
  let failSave = false;
  const provider: FakeProvider = {
    name,
    saved,
    signals,
    load(signal) {
      signals.push(signal);
      return options.load ? options.load.promise : Promise.resolve(options.document ?? null);
    },
    emit(document) {
      listener?.(document);
    },
    fail(error) {
      errorListener?.(error);
    },
    failNextSave() {
      failSave = true;
    },
  };
  const writable: Partial<ConfigProvider> = {
    async save(document, signal) {
      signals.push(signal);
      await options.saveGate?.();
      if (failSave) {
        failSave = false;
        throw new Error('Network down');
      }
      saved.push(document);
    },
  };
  const watchable: Partial<ConfigProvider> = {
    subscribe(onChange, onError) {
      listener = onChange;
      errorListener = onError;
      return () => {
        listener = undefined;
        errorListener = undefined;
      };
    },
  };
  return Object.assign(
    provider,
    options.writable === false ? {} : writable,
    options.watch ? watchable : {},
  );
}

function setup(options: Partial<ConfigStoreOptions<Config>> = {}) {
  const errors: WandError[] = [];
  const store = createConfigStore<Config>({
    sections: [chalk, glitter],
    onError: (error) => errors.push(error),
    ...options,
  });
  return { store, errors };
}

async function flush(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('schema composition', () => {
  it('adds the theme section and an implicit enabled field', () => {
    const { store } = setup();
    expect(store.sections.map((section) => section.name)).toEqual(['theme', 'chalk', 'glitter']);
    expect(Object.keys(store.sections[1]?.schema ?? {})).toEqual(['enabled', 'size', 'color']);
    expect(store.get()).toEqual({
      theme: { color: '#ffffff', motion: 'auto', maxDpr: 2 },
      chalk: { enabled: true, size: 15, color: null },
      glitter: { enabled: true, maxParticles: 300 },
    });
  });

  it('does not add the enabled field to the theme section', () => {
    const { store } = setup({ sections: [] });
    expect(store.get()).toEqual({ theme: { color: '#ffffff', motion: 'auto', maxDpr: 2 } });
  });

  it('applies the config layer over the defaults', () => {
    const { store } = setup({ defaults: { chalk: { size: 20 }, theme: { maxDpr: 2.7 } } });
    expect(store.get().chalk.size).toBe(20);
    expect(store.get().theme.maxDpr).toBe(2.5);
  });
});

describe('precedence', () => {
  it('keeps the value of a fast provider with high precedence over a slow provider with low precedence', async () => {
    const slow = deferred<ConfigDocument | null>();
    const low = fakeProvider('remote', { load: slow, writable: false });
    const high = fakeProvider('local', { document: { v: 1, chalk: { size: 30 } } });
    const { store } = setup({ providers: [low, high] });

    await flush();
    expect(store.get().chalk.size).toBe(30);

    slow.resolve({ v: 1, chalk: { size: 5, color: '#ff0000' } });
    await store.ready;
    expect(store.get().chalk).toEqual({ enabled: true, size: 30, color: '#ff0000' });
  });

  it('lets the runtime layer override each provider', async () => {
    const local = fakeProvider('local', { document: { v: 1, chalk: { size: 30 } } });
    const { store } = setup({ providers: [local] });
    await store.ready;
    store.set({ chalk: { size: 40 } });
    expect(store.get().chalk.size).toBe(40);
  });

  it('starts at once with the defaults and the config layer', () => {
    const pending = fakeProvider('remote', { load: deferred() });
    const { store } = setup({ providers: [pending], defaults: { glitter: { enabled: false } } });
    expect(store.get().glitter.enabled).toBe(false);
  });
});

describe('locked paths', () => {
  it('removes locked paths from the provider and runtime layers only', async () => {
    const local = fakeProvider('local', {
      document: { v: 1, glitter: { maxParticles: 900 }, chalk: { size: 30 } },
    });
    const { store } = setup({
      providers: [local],
      defaults: { glitter: { maxParticles: 100 } },
      locked: ['glitter.maxParticles'],
    });
    await store.ready;
    expect(store.get().glitter.maxParticles).toBe(100);
    expect(store.get().chalk.size).toBe(30);

    store.set({ glitter: { maxParticles: 800 } });
    store.import({ v: 1, glitter: { maxParticles: 700 } });
    expect(store.get().glitter.maxParticles).toBe(100);
  });
});

describe('validation', () => {
  it('ignores values that are not valid and emits a validation error', async () => {
    const local = fakeProvider('local', {
      document: { v: 1, chalk: { size: 'huge', color: 'red' }, glitter: { maxParticles: 5000 } },
    });
    const { store, errors } = setup({ providers: [local] });
    await store.ready;
    expect(store.get().chalk).toEqual({ enabled: true, size: 15, color: null });
    expect(store.get().glitter.maxParticles).toBe(1000);
    expect(errors.map((error) => [error.kind, error.source, error.message])).toEqual([
      ['validation', 'local', 'The value of "chalk.size" is not valid. The store ignores it.'],
      ['validation', 'local', 'The value of "chalk.color" is not valid. The store ignores it.'],
    ]);
  });

  it('reports a section that is not an object', () => {
    const { store, errors } = setup();
    store.import({ v: 1, chalk: 5 });
    expect(errors[0]?.message).toBe('The section "chalk" is not an object. The store ignores it.');
  });

  it('validates the runtime and config layers', () => {
    const { store, errors } = setup({ defaults: { chalk: { size: Number.NaN } } });
    store.set({ theme: { motion: 'fast' as never } });
    expect(errors.map((error) => error.source)).toEqual(['config', 'setConfig']);
    expect(store.get().theme.motion).toBe('auto');
  });

  it('rejects documents with a missing or non-numeric version', async () => {
    const missing = fakeProvider('a', { document: { chalk: { size: 30 } } as never });
    const text = fakeProvider('b', { document: { v: '1', chalk: { size: 31 } } as never });
    const { store, errors } = setup({ providers: [missing, text] });
    await store.ready;
    store.import({ chalk: { size: 32 } });
    store.import('not a document');
    expect(store.get().chalk.size).toBe(15);
    expect(errors).toHaveLength(4);
    expect(errors.every((error) => error.kind === 'validation')).toBe(true);
    expect(errors.map((error) => error.source)).toEqual(['a', 'b', 'import', 'import']);
  });

  it('reads a document from a future version field by field', async () => {
    const remote = fakeProvider('remote', {
      document: { v: 99, chalk: { size: 25, texture: 'rough' }, glitter: { maxParticles: 'x' } },
    });
    const { store, errors } = setup({ providers: [remote] });
    await store.ready;
    expect(store.get().chalk.size).toBe(25);
    expect(store.get().chalk).not.toHaveProperty('texture');
    expect(errors).toHaveLength(1);
  });
});

describe('unknown sections', () => {
  it('keeps unknown sections and their fields in the export', async () => {
    const remote = fakeProvider('remote', {
      document: { v: 1, sparkles: { density: 3, nested: { a: [1, 2] } }, chalk: { size: 20 } },
      writable: false,
    });
    const { store } = setup({ providers: [remote] });
    await store.ready;
    expect(store.get()).not.toHaveProperty('sparkles');
    expect(store.export()).toEqual({
      v: 1,
      theme: { color: '#ffffff', motion: 'auto', maxDpr: 2 },
      chalk: { enabled: true, size: 20, color: null },
      glitter: { enabled: true, maxParticles: 300 },
      sparkles: { density: 3, nested: { a: [1, 2] } },
    });
  });

  it('round-trips an export through import', async () => {
    const { store } = setup();
    store.import({ v: 1, chalk: { size: 12 }, sparkles: { density: 3 } });
    const other = setup().store;
    other.import(store.export());
    expect(other.export()).toEqual(store.export());
  });
});

describe('subscribe', () => {
  it('notifies only when the merged result changes', () => {
    const { store } = setup();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    const before = store.get();

    store.set({ chalk: { size: 15 } });
    expect(listener).not.toHaveBeenCalled();
    expect(store.get()).toBe(before);

    store.set({ chalk: { size: 16 } });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(store.get(), before);

    unsubscribe();
    store.set({ chalk: { size: 17 } });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does not notify for a change in an unknown section', () => {
    const { store } = setup();
    const listener = vi.fn();
    store.subscribe(listener);
    store.import({ v: 1, sparkles: { density: 3 } });
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('autosave', () => {
  it('saves once after the debounce time', async () => {
    const local = fakeProvider('local');
    const { store } = setup({ providers: [local] });
    await store.ready;

    store.set({ chalk: { size: 20 } });
    await vi.advanceTimersByTimeAsync(300);
    store.set({ glitter: { maxParticles: 10 } });
    await vi.advanceTimersByTimeAsync(499);
    expect(local.saved).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(1);
    expect(local.saved).toEqual([{ v: 1, chalk: { size: 20 }, glitter: { maxParticles: 10 } }]);
  });

  it('uses the autosaveDebounceMs option', async () => {
    const local = fakeProvider('local');
    const { store } = setup({ providers: [local], autosaveDebounceMs: 50 });
    store.set({ chalk: { size: 20 } });
    await vi.advanceTimersByTimeAsync(50);
    expect(local.saved).toHaveLength(1);
  });

  it('does nothing when no provider can save', async () => {
    const remote = fakeProvider('remote', { writable: false });
    const { store, errors } = setup({ providers: [remote] });
    store.set({ chalk: { size: 20 } });
    await vi.advanceTimersByTimeAsync(1000);
    expect(errors).toEqual([]);
    expect(store.get().chalk.size).toBe(20);
  });
});

describe('save', () => {
  it('saves only the difference to the layers below the target provider', async () => {
    const remote = fakeProvider('remote', {
      document: { v: 1, chalk: { size: 30 }, glitter: { maxParticles: 50 } },
      writable: false,
    });
    const local = fakeProvider('local', { document: { v: 1, theme: { color: '#00ff00' } } });
    const { store } = setup({ providers: [remote, local], defaults: { chalk: { size: 10 } } });
    await store.ready;

    store.set({ chalk: { size: 30 }, glitter: { maxParticles: 60 } });
    await store.save();
    expect(local.saved).toEqual([
      { v: 1, theme: { color: '#00ff00' }, glitter: { maxParticles: 60 } },
    ]);
  });

  it('moves the difference to the target slot and clears the runtime layer', async () => {
    const local = fakeProvider('local', { watch: true });
    const { store } = setup({ providers: [local] });
    await store.ready;
    store.set({ chalk: { size: 20 } });
    await store.save();

    const listener = vi.fn();
    store.subscribe(listener);
    local.emit(null);
    expect(store.get().chalk.size).toBe(15);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('selects a provider with the to option', async () => {
    const remote = fakeProvider('remote');
    const local = fakeProvider('local');
    const { store } = setup({ providers: [remote, local] });
    await store.ready;
    store.set({ chalk: { size: 20 } });
    await store.save({ to: 'remote' });
    expect(remote.saved).toEqual([{ v: 1, chalk: { size: 20 } }]);
    expect(local.saved).toEqual([]);

    await vi.advanceTimersByTimeAsync(1000);
    expect(local.saved).toEqual([]);
  });

  it('includes unknown sections in the difference', async () => {
    const local = fakeProvider('local', { document: { v: 1, sparkles: { density: 3 } } });
    const { store } = setup({ providers: [local] });
    await store.ready;
    store.set({ chalk: { size: 20 } });
    await store.save();
    expect(local.saved[0]).toEqual({ v: 1, sparkles: { density: 3 }, chalk: { size: 20 } });
  });

  it('reports a provider error for an unknown or read-only target', async () => {
    const remote = fakeProvider('remote', { writable: false });
    const { store, errors } = setup({ providers: [remote] });
    await expect(store.save({ to: 'remote' })).resolves.toBeUndefined();
    await expect(store.save({ to: 'missing' })).resolves.toBeUndefined();
    expect(errors.map((error) => [error.kind, error.source])).toEqual([
      ['provider', 'remote'],
      ['provider', 'missing'],
    ]);
  });

  it('keeps the runtime layer when the save fails', async () => {
    const local = fakeProvider('local', { watch: true });
    const { store, errors } = setup({ providers: [local] });
    await store.ready;
    store.set({ chalk: { size: 20 } });
    local.failNextSave();
    await expect(store.save()).resolves.toBeUndefined();
    expect(errors[0]).toMatchObject({ kind: 'provider', source: 'local' });
    expect(errors[0]?.cause).toBeInstanceOf(Error);

    local.emit(null);
    expect(store.get().chalk.size).toBe(20);
  });

  it('waits for the target provider to load before it saves', async () => {
    const slow = deferred<ConfigDocument | null>();
    const local = fakeProvider('local', { load: slow });
    const { store } = setup({ providers: [local] });
    store.set({ chalk: { size: 20 } });
    await vi.advanceTimersByTimeAsync(1000);
    expect(local.saved).toEqual([]);

    slow.resolve({ v: 1, glitter: { maxParticles: 5 } });
    await flush();
    expect(local.saved).toEqual([{ v: 1, glitter: { maxParticles: 5 }, chalk: { size: 20 } }]);
  });

  it('keeps a runtime change that arrives while a save is in progress', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const local = fakeProvider('local', { saveGate: () => gate });
    const { store } = setup({ providers: [local] });
    await store.ready;
    store.set({ chalk: { size: 20 } });
    const saving = store.save();
    await flush();
    store.set({ chalk: { size: 25 }, glitter: { maxParticles: 7 } });
    release();
    await saving;

    expect(store.get().chalk.size).toBe(25);
    await vi.advanceTimersByTimeAsync(500);
    expect(local.saved[local.saved.length - 1]).toEqual({
      v: 1,
      chalk: { size: 25 },
      glitter: { maxParticles: 7 },
    });
  });
});

describe('echo prevention', () => {
  it('applies a provider change without a save', async () => {
    const local = fakeProvider('local', { watch: true });
    const { store } = setup({ providers: [local] });
    await store.ready;
    const listener = vi.fn();
    store.subscribe(listener);

    local.emit({ v: 1, chalk: { size: 44 } });
    expect(store.get().chalk.size).toBe(44);
    expect(listener).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5000);
    expect(local.saved).toEqual([]);
  });

  it('ignores a late load result after a subscription update', async () => {
    const slow = deferred<ConfigDocument | null>();
    const local = fakeProvider('local', { load: slow, watch: true });
    const { store } = setup({ providers: [local] });
    local.emit({ v: 1, chalk: { size: 44 } });
    slow.resolve({ v: 1, chalk: { size: 2 } });
    await store.ready;
    expect(store.get().chalk.size).toBe(44);
  });

  it('keeps the slot when a provider sends a document that is not valid', async () => {
    const local = fakeProvider('local', { watch: true, document: { v: 1, chalk: { size: 30 } } });
    const { store, errors } = setup({ providers: [local] });
    await store.ready;
    local.emit({ chalk: { size: 2 } } as never);
    expect(store.get().chalk.size).toBe(30);
    expect(errors[0]?.kind).toBe('validation');
  });

  it('reports a provider error from a subscription and keeps the slot', async () => {
    const remote = fakeProvider('remote', { watch: true, document: { v: 1, chalk: { size: 30 } } });
    const { store, errors } = setup({ providers: [remote] });
    await store.ready;
    const cause = new Error('Poll failed');
    remote.fail(cause);
    expect(store.get().chalk.size).toBe(30);
    expect(errors).toEqual([
      {
        kind: 'provider',
        source: 'remote',
        message: 'The provider "remote" cannot read a change of the configuration.',
        cause,
      },
    ]);
    store.destroy();
    remote.fail(cause);
    expect(errors).toHaveLength(1);
  });
});

describe('reset', () => {
  it('clears the runtime layer and the target provider', async () => {
    const remote = fakeProvider('remote', {
      document: { v: 1, chalk: { size: 30 } },
      writable: false,
    });
    const local = fakeProvider('local', { document: { v: 1, chalk: { size: 40 } } });
    const { store } = setup({ providers: [remote, local] });
    await store.ready;
    store.set({ glitter: { maxParticles: 1 } });

    store.reset();
    expect(store.get().chalk.size).toBe(30);
    expect(store.get().glitter.maxParticles).toBe(300);
    await flush();
    expect(local.saved).toEqual([{ v: 1 }]);

    await vi.advanceTimersByTimeAsync(1000);
    expect(local.saved).toHaveLength(1);
  });

  it('clears only the runtime layer when no provider can save', () => {
    const { store } = setup();
    store.set({ chalk: { size: 20 } });
    store.reset();
    expect(store.get().chalk.size).toBe(15);
  });
});

describe('loading', () => {
  it('resolves ready when a provider fails and reports a provider error', async () => {
    const throwing: ConfigProvider = {
      name: 'broken',
      load() {
        throw new Error('Sync failure');
      },
    };
    const pending = deferred<ConfigDocument | null>();
    const remote: ConfigProvider = { name: 'remote', load: () => pending.promise };
    const { store, errors } = setup({ providers: [remote, throwing] });
    pending.reject(new Error('Offline'));
    await expect(store.ready).resolves.toBeUndefined();
    expect(errors.map((error) => [error.kind, error.source]).sort()).toEqual([
      ['provider', 'broken'],
      ['provider', 'remote'],
    ]);
  });

  it('merges again on each provider arrival', async () => {
    const first = deferred<ConfigDocument | null>();
    const second = deferred<ConfigDocument | null>();
    const a = fakeProvider('a', { load: first, writable: false });
    const b = fakeProvider('b', { load: second, writable: false });
    const { store } = setup({ providers: [a, b] });
    const listener = vi.fn();
    store.subscribe(listener);

    first.resolve({ v: 1, chalk: { size: 20 } });
    await flush();
    expect(store.get().chalk.size).toBe(20);
    second.resolve({ v: 1, glitter: { maxParticles: 3 } });
    await store.ready;
    expect(store.get().glitter.maxParticles).toBe(3);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('destroy', () => {
  it('aborts the requests and ignores late results', async () => {
    const slow = deferred<ConfigDocument | null>();
    const local = fakeProvider('local', { load: slow, watch: true });
    const { store, errors } = setup({ providers: [local] });
    const listener = vi.fn();
    store.subscribe(listener);

    store.destroy();
    expect(local.signals[0]?.aborted).toBe(true);

    slow.reject(new DOMException('Aborted', 'AbortError'));
    await expect(store.ready).resolves.toBeUndefined();
    local.emit({ v: 1, chalk: { size: 44 } });
    store.set({ chalk: { size: 33 } });
    await vi.advanceTimersByTimeAsync(1000);

    expect(store.get().chalk.size).toBe(15);
    expect(listener).not.toHaveBeenCalled();
    expect(local.saved).toEqual([]);
    expect(errors).toEqual([]);
  });

  it('cancels a pending autosave', async () => {
    const local = fakeProvider('local');
    const { store } = setup({ providers: [local] });
    await store.ready;
    store.set({ chalk: { size: 20 } });
    store.destroy();
    await vi.advanceTimersByTimeAsync(1000);
    expect(local.saved).toEqual([]);
  });
});

describe('resolveSection', () => {
  it('replaces null with the theme color', () => {
    const theme = { color: '#abcdef', motion: 'auto' as const, maxDpr: 2 };
    expect(resolveSection({ enabled: true, size: 15, color: null }, theme)).toEqual({
      enabled: true,
      size: 15,
      color: '#abcdef',
    });
  });
});
