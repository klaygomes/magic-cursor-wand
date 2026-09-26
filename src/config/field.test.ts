import { describe, expect, it } from 'vitest';
import { field } from './field';

const meta = { label: 'Size', description: 'The size.' };

describe('field.number', () => {
  const size = field.number({ ...meta, default: 0.015, min: 0.001, max: 0.05, step: 0.001 });

  it('clamps to the range and snaps to the step', () => {
    expect(size.parse(1)).toBe(0.05);
    expect(size.parse(-1)).toBe(0.001);
    expect(size.parse(0.0154)).toBe(0.015);
    expect(size.parse('0.02')).toBe(0.02);
  });

  it('rejects values that are not finite numbers', () => {
    expect(size.parse(Number.NaN)).toBeUndefined();
    expect(size.parse('abc')).toBeUndefined();
    expect(size.parse('')).toBeUndefined();
    expect(size.parse(null)).toBeUndefined();
  });
});

describe('field.color', () => {
  it('accepts lowercase and uppercase hex and returns lowercase', () => {
    const color = field.color({ ...meta, default: '#ffffff' });
    expect(color.parse('#AABBCC')).toBe('#aabbcc');
    expect(color.parse('red')).toBeUndefined();
    expect(color.parse(null)).toBeUndefined();
  });

  it('accepts null when nullable', () => {
    const color = field.color({ ...meta, default: null, nullable: true });
    expect(color.parse(null)).toBeNull();
  });
});

describe('field.boolean and field.enum', () => {
  it('accepts only valid values', () => {
    expect(field.boolean({ ...meta, default: true }).parse('true')).toBeUndefined();
    const motion = field.enum({ ...meta, default: 'auto', options: ['auto', 'off'] });
    expect(motion.parse('off')).toBe('off');
    expect(motion.parse('fast')).toBeUndefined();
  });
});
