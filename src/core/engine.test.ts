import { describe, expect, it } from 'vitest';
import { field } from '../config/field';
import { sectionValues } from './engine';

describe('sectionValues', () => {
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
    expect(
      sectionValues(schema, { tint: null }, { color: '#123456', motion: 'auto', maxDpr: 2 }),
    ).toEqual({
      size: 4,
      tint: '#123456',
    });
  });

  it('keeps the values of the section and drops the other keys', () => {
    expect(
      sectionValues(
        schema,
        { size: 2, tint: '#abcdef', enabled: true },
        { color: '#000000', motion: 'auto', maxDpr: 2 },
      ),
    ).toEqual({
      size: 2,
      tint: '#abcdef',
    });
  });
});
