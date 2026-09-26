import { describe, expect, it } from 'vitest';

describe('browser environment', () => {
  it('provides a 2D canvas context with Path2D and shadowBlur', () => {
    const context = document.createElement('canvas').getContext('2d');
    expect(context).not.toBeNull();
    expect(typeof Path2D).toBe('function');
    expect(context && 'shadowBlur' in context).toBe(true);
  });
});
