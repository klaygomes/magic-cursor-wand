import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConfigDocument } from '../config/types';
import { localStorageProvider, type StorageLike } from './local-storage';

const signal = new AbortController().signal;

class FakeStorage implements StorageLike {
  readonly items = new Map<string, string>();
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
}

class ThrowingStorage implements StorageLike {
  getItem(): string | null {
    throw new Error('SecurityError');
  }
  setItem(): void {
    throw new Error('QuotaExceededError');
  }
}

function storageEvent(init: {
  key: string | null;
  newValue: string | null;
  storageArea: unknown;
}): Event {
  return Object.assign(new Event('storage'), init);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('localStorageProvider', () => {
  it('uses the default name', () => {
    expect(localStorageProvider({ key: 'k', storage: new FakeStorage() }).name).toBe('local');
    expect(localStorageProvider({ key: 'k', name: 'mine' }).name).toBe('mine');
  });

  it('saves and loads a document', async () => {
    const storage = new FakeStorage();
    const provider = localStorageProvider({ key: 'wand', storage });
    await provider.save?.({ v: 1, chalk: { size: 3 } }, signal);
    expect(storage.items.get('wand')).toBe('{"v":1,"chalk":{"size":3}}');
    await expect(provider.load(signal)).resolves.toEqual({ v: 1, chalk: { size: 3 } });
  });

  it('loads null for a missing key or JSON that is not valid', async () => {
    const storage = new FakeStorage();
    const provider = localStorageProvider({ key: 'wand', storage });
    await expect(provider.load(signal)).resolves.toBeNull();
    storage.setItem('wand', '{not json');
    await expect(provider.load(signal)).resolves.toBeNull();
  });

  it('rejects a value that is not a document', async () => {
    const storage = new FakeStorage();
    storage.setItem('wand', '[1,2]');
    const provider = localStorageProvider({ key: 'wand', storage });
    await expect(provider.load(signal)).rejects.toThrow(/"local".*not valid/);
  });

  it('loads null when the storage throws and rejects the save', async () => {
    const provider = localStorageProvider({ key: 'wand', storage: new ThrowingStorage() });
    await expect(provider.load(signal)).resolves.toBeNull();
    await expect(provider.save?.({ v: 1 }, signal)).rejects.toThrow(/cannot write the key "wand"/);
  });

  it('loads null without a window and does not subscribe', async () => {
    const provider = localStorageProvider({ key: 'wand' });
    await expect(provider.load(signal)).resolves.toBeNull();
    const unsubscribe = provider.subscribe?.(() => {});
    expect(() => unsubscribe?.()).not.toThrow();
  });

  it('delivers storage events for its key and storage area only', () => {
    const target = new EventTarget();
    vi.stubGlobal('window', target);
    const storage = new FakeStorage();
    const other = new FakeStorage();
    const changes: (ConfigDocument | null)[] = [];
    const provider = localStorageProvider({ key: 'wand', storage });
    const unsubscribe = provider.subscribe?.((document) => changes.push(document));

    target.dispatchEvent(storageEvent({ key: 'wand', newValue: '{"v":1}', storageArea: storage }));
    target.dispatchEvent(storageEvent({ key: 'other', newValue: '{"v":2}', storageArea: storage }));
    target.dispatchEvent(storageEvent({ key: 'wand', newValue: '{"v":3}', storageArea: other }));
    target.dispatchEvent(storageEvent({ key: 'wand', newValue: '{bad', storageArea: storage }));
    target.dispatchEvent(storageEvent({ key: 'wand', newValue: '{"x":1}', storageArea: storage }));
    target.dispatchEvent(storageEvent({ key: null, newValue: null, storageArea: storage }));

    expect(changes).toEqual([{ v: 1 }, null, null]);

    unsubscribe?.();
    target.dispatchEvent(storageEvent({ key: 'wand', newValue: '{"v":4}', storageArea: storage }));
    expect(changes).toHaveLength(3);
  });
});
