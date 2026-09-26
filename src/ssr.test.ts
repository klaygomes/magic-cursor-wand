import { describe, expect, it } from 'vitest';

describe('server-side rendering', () => {
  it('runs in an environment without window and document', () => {
    expect(typeof window).toBe('undefined');
    expect(typeof document).toBe('undefined');
  });

  it.each([
    ['main', () => import('./index')],
    ['providers', () => import('./providers')],
    ['cursor', () => import('./cursor')],
    ['panel', () => import('./panel')],
    ['react', () => import('./react')],
    ['script build', () => import('./iife')],
  ])('imports the %s entry without access to the DOM', async (_name, load) => {
    const entry = await load();
    expect(Object.keys(entry).length).toBeGreaterThan(0);
  });
});
