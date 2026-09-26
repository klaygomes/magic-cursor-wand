import { describe, expect, it } from 'vitest';
import { seededRandom } from './testing';
import { createNoise, easeInOutCirc, hexToRgb, imageSize, Pool } from './util';

describe('createNoise', () => {
  it('gives the same values for the same seed', () => {
    const first = createNoise(seededRandom(7));
    const second = createNoise(seededRandom(7));
    for (const x of [0, 0.3, 17.25, 511.9, 900]) expect(first(x)).toBe(second(x));
  });

  it('keeps values in the range from 0 to 1 and passes through the table values', () => {
    const table = seededRandom(3);
    const expected = [table(), table()];
    const noise = createNoise(seededRandom(3));
    expect(noise(0)).toBeCloseTo(expected[0] ?? Number.NaN, 6);
    expect(noise(1)).toBeCloseTo(expected[1] ?? Number.NaN, 6);
    for (let x = -20; x < 1100; x += 0.37) {
      const value = noise(x);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('changes smoothly between integer positions', () => {
    const noise = createNoise(seededRandom(11));
    for (let x = 0; x < 50; x += 0.01) {
      expect(Math.abs(noise(x + 0.01) - noise(x))).toBeLessThan(0.02);
    }
  });

  it('repeats after 512 positions', () => {
    const noise = createNoise(seededRandom(5));
    expect(noise(3.5)).toBeCloseTo(noise(515.5), 6);
  });
});

describe('easeInOutCirc', () => {
  it('maps the ends and the middle to themselves', () => {
    expect(easeInOutCirc(0)).toBe(0);
    expect(easeInOutCirc(0.5)).toBe(0.5);
    expect(easeInOutCirc(1)).toBe(1);
  });

  it('increases monotonically', () => {
    let previous = 0;
    for (let x = 0.01; x <= 1; x += 0.01) {
      const value = easeInOutCirc(x);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });
});

describe('hexToRgb', () => {
  it('parses a color with or without the hash', () => {
    expect(hexToRgb('#ff8000')).toEqual({ r: 255, g: 128, b: 0 });
    expect(hexToRgb('0A0b0C')).toEqual({ r: 10, g: 11, b: 12 });
  });

  it('gives white for a color that is not valid', () => {
    expect(hexToRgb('red')).toEqual({ r: 255, g: 255, b: 255 });
  });
});

describe('Pool', () => {
  it('reuses objects after clear', () => {
    let created = 0;
    const pool = new Pool(() => ({ id: created++ }));
    const first = pool.acquire();
    pool.acquire();
    pool.clear();
    expect(pool.acquire()).toBe(first);
    expect(created).toBe(2);
  });

  it('swaps items when it compacts', () => {
    const pool = new Pool(() => ({ alive: true }));
    const a = pool.acquire();
    const b = pool.acquire();
    pool.move(1, 0);
    expect(pool.items).toEqual([b, a]);
  });
});

describe('imageSize', () => {
  it('prefers the natural size', () => {
    expect(
      imageSize({ naturalWidth: 40, naturalHeight: 20, width: 1, height: 1 } as never),
    ).toEqual({ width: 40, height: 20 });
  });

  it('reads the size of a canvas', () => {
    expect(imageSize({ width: 8, height: 4 } as never)).toEqual({ width: 8, height: 4 });
  });

  it('gives a unit square for an unknown size', () => {
    expect(imageSize({} as never)).toEqual({ width: 1, height: 1 });
  });
});
