import { describe, expect, it } from 'vitest';
import { migrateDocument, migrations } from './migrations';
import { theme } from './theme';
import type { ConfigDocument, Migration } from './types';

describe('migrateDocument', () => {
  it('returns a document of the current version without changes', () => {
    const document = { v: 1, chalk: { size: 20 } };
    expect(migrateDocument(document)).toEqual({ ok: true, document });
    expect(migrations).toEqual({});
  });

  it('applies the migrations in sequence and sets the version', () => {
    const registry: Record<number, Migration> = {
      1: ({ v, ...rest }) => ({ v, ...rest, renamed: rest.old }),
      2: (document) => ({ ...document, third: true }),
    };
    const result = migrateDocument({ v: 1, old: 'x' }, registry, 3);
    expect(result).toEqual({
      ok: true,
      document: { v: 3, old: 'x', renamed: 'x', third: true } as ConfigDocument,
    });
  });

  it('rejects a document without a valid version', () => {
    for (const input of [null, [], 'x', {}, { v: '1' }, { v: 0 }, { v: 1.5 }, { v: Number.NaN }]) {
      expect(migrateDocument(input).ok).toBe(false);
    }
  });

  it('fails when a migration step is missing', () => {
    const result = migrateDocument({ v: 1 }, {}, 2);
    expect(result).toEqual({
      ok: false,
      message: 'No migration exists from version 1 to version 2.',
    });
  });

  it('fails when a migration throws', () => {
    const cause = new Error('Bad data');
    const result = migrateDocument(
      { v: 1 },
      {
        1: () => {
          throw cause;
        },
      },
      2,
    );
    expect(result).toMatchObject({ ok: false, cause });
  });

  it('keeps a document from a later version', () => {
    const document = { v: 7, chalk: { size: 20 } };
    expect(migrateDocument(document)).toEqual({ ok: true, document });
  });
});

describe('theme', () => {
  it('declares the core theme fields', () => {
    expect(theme.name).toBe('theme');
    expect(theme.schema.color.default).toBe('#ffffff');
    expect(theme.schema.motion.options).toEqual(['auto', 'full', 'reduced', 'off']);
    expect(theme.schema.maxDpr.parse(10)).toBe(3);
    expect(theme.schema.maxDpr.parse(1.3)).toBe(1.5);
  });
});
