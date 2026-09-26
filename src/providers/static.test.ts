import { describe, expect, it } from 'vitest';
import { staticProvider } from './static';

const signal = new AbortController().signal;

describe('staticProvider', () => {
  it('loads the given document and has no save or subscribe', async () => {
    const provider = staticProvider({ v: 1, chalk: { size: 20 } });
    expect(provider.name).toBe('static');
    await expect(provider.load(signal)).resolves.toEqual({ v: 1, chalk: { size: 20 } });
    expect(provider.save).toBeUndefined();
    expect(provider.subscribe).toBeUndefined();
  });

  it('uses the given name', () => {
    expect(staticProvider({ v: 1 }, 'defaults').name).toBe('defaults');
  });

  it('rejects a document that is not valid', async () => {
    const provider = staticProvider({ chalk: {} } as never);
    await expect(provider.load(signal)).rejects.toThrow(/not valid/);
  });
});
