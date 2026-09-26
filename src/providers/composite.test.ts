import { describe, expect, it, vi } from 'vitest';
import type { ConfigDocument, ConfigProvider } from '../config/types';
import { compositeProvider } from './composite';
import { staticProvider } from './static';

const signal = new AbortController().signal;

function observable(name: string, initial: ConfigDocument | null) {
  const listeners = new Set<(document: ConfigDocument | null) => void>();
  const saved: ConfigDocument[] = [];
  const provider: ConfigProvider = {
    name,
    load: async () => initial,
    save: async (document) => {
      saved.push(document);
    },
    subscribe: (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
  };
  const push = (document: ConfigDocument | null): void => {
    for (const listener of listeners) listener(document);
  };
  return { provider, push, saved, listeners };
}

describe('compositeProvider', () => {
  it('merges child documents in order', async () => {
    const composite = compositeProvider('both', [
      staticProvider({ v: 1, chalk: { size: 1, color: '#000000' }, glitter: { enabled: false } }),
      staticProvider({ v: 1, chalk: { size: 2 } }),
    ]);
    expect(composite.name).toBe('both');
    await expect(composite.load(signal)).resolves.toEqual({
      v: 1,
      chalk: { size: 2, color: '#000000' },
      glitter: { enabled: false },
    });
  });

  it('loads null when all children load null', async () => {
    const composite = compositeProvider('none', [observable('a', null).provider]);
    await expect(composite.load(signal)).resolves.toBeNull();
  });

  it('ignores a failed child when another child loads', async () => {
    const failing: ConfigProvider = { name: 'bad', load: () => Promise.reject(new Error('Down.')) };
    const composite = compositeProvider('mixed', [failing, staticProvider({ v: 1, a: { x: 1 } })]);
    await expect(composite.load(signal)).resolves.toEqual({ v: 1, a: { x: 1 } });
  });

  it('rejects when all children fail', async () => {
    const failing: ConfigProvider = { name: 'bad', load: () => Promise.reject(new Error('Down.')) };
    await expect(compositeProvider('x', [failing]).load(signal)).rejects.toThrow('Down.');
  });

  it('omits save and subscribe without capable children', () => {
    const composite = compositeProvider('ro', [staticProvider({ v: 1 })]);
    expect(composite.save).toBeUndefined();
    expect(composite.subscribe).toBeUndefined();
  });

  it('sends a save to each writable child', async () => {
    const a = observable('a', null);
    const b = observable('b', null);
    const composite = compositeProvider('rw', [a.provider, staticProvider({ v: 1 }), b.provider]);
    await composite.save?.({ v: 1, chalk: { size: 3 } }, signal);
    expect(a.saved).toEqual([{ v: 1, chalk: { size: 3 } }]);
    expect(b.saved).toEqual([{ v: 1, chalk: { size: 3 } }]);
  });

  it('merges child changes with the loaded documents', async () => {
    const low = observable('low', { v: 1, chalk: { size: 1, color: '#111111' } });
    const high = observable('high', { v: 1, chalk: { size: 5 } });
    const composite = compositeProvider('live', [low.provider, high.provider]);
    await composite.load(signal);
    const onChange = vi.fn();
    const unsubscribe = composite.subscribe?.(onChange);

    low.push({ v: 1, chalk: { size: 9, color: '#222222' } });
    expect(onChange).toHaveBeenLastCalledWith({ v: 1, chalk: { size: 5, color: '#222222' } });

    high.push(null);
    expect(onChange).toHaveBeenLastCalledWith({ v: 1, chalk: { size: 9, color: '#222222' } });

    unsubscribe?.();
    expect(low.listeners.size).toBe(0);
    expect(high.listeners.size).toBe(0);
  });

  it('sends the errors of each child subscription to the error handler', () => {
    let childError: ((error: unknown) => void) | undefined;
    const child: ConfigProvider = {
      name: 'child',
      load: async () => null,
      subscribe: (_onChange, onError) => {
        childError = onError;
        return () => {};
      },
    };
    const onError = vi.fn();
    compositeProvider('wrap', [child]).subscribe?.(() => {}, onError);
    const cause = new Error('Poll failed.');
    childError?.(cause);
    expect(onError).toHaveBeenCalledExactlyOnceWith(cause);
  });
});
