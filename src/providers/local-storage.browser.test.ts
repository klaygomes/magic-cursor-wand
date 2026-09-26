import { afterEach, describe, expect, it } from 'vitest';
import type { ConfigDocument } from '../config/types';
import { localStorageProvider } from './local-storage';

const key = 'magic-cursor-wand-test';
const signal = new AbortController().signal;

afterEach(() => {
  localStorage.removeItem(key);
});

describe('localStorageProvider in the browser', () => {
  it('saves to and loads from the real localStorage', async () => {
    const provider = localStorageProvider({ key });
    await provider.save?.({ v: 1, glitter: { enabled: false } }, signal);
    expect(localStorage.getItem(key)).toBe('{"v":1,"glitter":{"enabled":false}}');
    await expect(provider.load(signal)).resolves.toEqual({ v: 1, glitter: { enabled: false } });
  });

  it('delivers a storage event from the real localStorage', () => {
    const provider = localStorageProvider({ key });
    const changes: (ConfigDocument | null)[] = [];
    const unsubscribe = provider.subscribe?.((document) => changes.push(document));

    const dispatch = (storageArea: Storage, newValue: string): void => {
      window.dispatchEvent(new StorageEvent('storage', { key, newValue, storageArea }));
    };
    dispatch(localStorage, '{"v":1,"chalk":{"size":7}}');
    dispatch(sessionStorage, '{"v":1,"chalk":{"size":9}}');
    unsubscribe?.();
    dispatch(localStorage, '{"v":1,"chalk":{"size":11}}');

    expect(changes).toEqual([{ v: 1, chalk: { size: 7 } }]);
  });
});
