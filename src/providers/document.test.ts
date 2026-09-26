import { describe, expect, it } from 'vitest';
import { isConfigDocument, mergeDocuments, toConfigDocument } from './document';

describe('isConfigDocument', () => {
  it('accepts plain objects with a numeric version', () => {
    expect(isConfigDocument({ v: 1 })).toBe(true);
    expect(isConfigDocument(Object.assign(Object.create(null), { v: 2 }))).toBe(true);
  });

  it('rejects other values', () => {
    for (const value of [null, 1, 'x', [], { v: '1' }, { v: Number.NaN }, {}, new Date()]) {
      expect(isConfigDocument(value)).toBe(false);
    }
  });
});

describe('toConfigDocument', () => {
  it('throws an error that names the source', () => {
    expect(() => toConfigDocument({ chalk: {} }, 'remote')).toThrow(/"remote".*not valid/);
  });
});

describe('mergeDocuments', () => {
  it('returns null without documents', () => {
    expect(mergeDocuments([])).toBeNull();
  });

  it('merges section by section and field by field', () => {
    const merged = mergeDocuments([
      { v: 1, chalk: { size: 10, color: '#ffffff' }, glitter: { enabled: false } },
      { v: 1, chalk: { size: 20 }, cloud: { enabled: true } },
    ]);
    expect(merged).toEqual({
      v: 1,
      chalk: { size: 20, color: '#ffffff' },
      glitter: { enabled: false },
      cloud: { enabled: true },
    });
  });
});
