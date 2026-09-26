import { describe, expect, it } from 'vitest';
import { field } from '../config/field';
import { resolveSection } from './engine';

describe('resolveSection', () => {
  const schema = {
    size: field.number({
      label: 'Size',
      description: 'Size.',
      default: 4,
      min: 0,
      max: 9,
      step: 1,
    }),
    tint: field.color<true>({ label: 'Tint', description: 'Tint.', default: null, nullable: true }),
  };

  it('gives the theme color to a null color and the default to a missing value', () => {
    expect(resolveSection(schema, { tint: null }, '#123456')).toEqual({
      size: 4,
      tint: '#123456',
    });
  });

  it('keeps the values of the section and drops the other keys', () => {
    expect(resolveSection(schema, { size: 2, tint: '#abcdef', enabled: true }, '#000000')).toEqual({
      size: 2,
      tint: '#abcdef',
    });
  });
});
