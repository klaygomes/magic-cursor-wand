import { describe, expect, it } from 'vitest';
import { commands, server } from 'vitest/browser';
import type { Effect, EffectConfig, Frame } from '../core/types';
import { chalkEffect, chalkSchema } from './chalk';
import { cloudEffect, cloudSchema } from './cloud';
import { glitterEffect, glitterSchema } from './glitter';
import { createGlowSprites } from './glow-mask';
import { createTestContext, defaultsOf, frameAt, pointerAt, type TestContext } from './testing';
import { context2d } from './util';

const WIDTH = 300;
const HEIGHT = 200;
const THEME = { color: '#ffffff', motion: 'auto', maxDpr: 1 } as const;

interface PixelStats {
  readonly painted: number;
  readonly maxAlpha: number;
  readonly mean: { r: number; g: number; b: number };
}

function createSurface(): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  return context2d(canvas);
}

function renderFrame(effect: Effect, surface: CanvasRenderingContext2D, frame: Frame): void {
  surface.setTransform(1, 0, 0, 1, 0, 0);
  surface.clearRect(0, 0, WIDTH, HEIGHT);
  surface.globalAlpha = 1;
  surface.globalCompositeOperation = effect.composite ?? 'source-over';
  effect.draw(surface, frame);
}

function stats(
  surface: CanvasRenderingContext2D,
  x = 0,
  y = 0,
  width = WIDTH,
  height = HEIGHT,
): PixelStats {
  const { data } = surface.getImageData(x, y, width, height);
  let painted = 0;
  let maxAlpha = 0;
  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3] ?? 0;
    if (alpha === 0) continue;
    painted++;
    maxAlpha = Math.max(maxAlpha, alpha);
    r += data[i] ?? 0;
    g += data[i + 1] ?? 0;
    b += data[i + 2] ?? 0;
  }
  const count = Math.max(1, painted);
  return { painted, maxAlpha, mean: { r: r / count, g: g / count, b: b / count } };
}

function mount<S extends Effect>(
  effect: S,
  config: S extends Effect<string, infer X> ? EffectConfig<X> : never,
  context: TestContext = createTestContext({ seed: 1234 }),
): S {
  effect.setup(context);
  effect.configure(config as never, THEME);
  return effect;
}

function renderCloud(): CanvasRenderingContext2D {
  const surface = createSurface();
  const effect = mount(cloudEffect(), { ...defaultsOf(cloudSchema), color: '#ff0000' });
  effect.pointer?.(pointerAt('move', 150, 120, { drawing: false }));
  for (let i = 0; i < 40; i++) effect.update(frameAt(i));
  renderFrame(effect, surface, frameAt(40));
  return surface;
}

function renderChalk(): CanvasRenderingContext2D {
  const surface = createSurface();
  const effect = mount(chalkEffect(), {
    ...defaultsOf(chalkSchema),
    color: '#00ff00',
    smoothing: 0,
  });
  effect.pointer?.(pointerAt('down', 50, 100));
  for (let x = 55; x <= 250; x += 5) {
    effect.pointer?.(pointerAt('move', x, 100, { samples: [{ x, y: 100 }] }));
  }
  effect.update(frameAt(0));
  renderFrame(effect, surface, frameAt(0));
  return surface;
}

function renderGlitter(): CanvasRenderingContext2D {
  const surface = createSurface();
  const context = createTestContext({ seed: 77 });
  const effect = mount(
    glitterEffect(),
    { ...defaultsOf(glitterSchema), color: '#ff00ff', twinkle: 1, size: 30, spawnRate: 20 },
    context,
  );
  context.bus.emit('burst', { x: 150, y: 100, strength: 1 });
  for (let i = 0; i < 5; i++) effect.update(frameAt(i));
  renderFrame(effect, surface, frameAt(5));
  return surface;
}

const CELL = 10;
const PIXEL_TOLERANCE = 8;

function alphaGrid(surface: CanvasRenderingContext2D): number[][] {
  const { data } = surface.getImageData(0, 0, WIDTH, HEIGHT);
  const rows: number[][] = [];
  for (let top = 0; top < HEIGHT; top += CELL) {
    const row: number[] = [];
    for (let left = 0; left < WIDTH; left += CELL) {
      let sum = 0;
      for (let y = top; y < top + CELL; y++) {
        for (let x = left; x < left + CELL; x++) sum += data[(y * WIDTH + x) * 4 + 3] ?? 0;
      }
      row.push(Math.round(sum / (CELL * CELL)));
    }
    rows.push(row);
  }
  return rows;
}

function largestDifference(actual: number[][], expected: number[][]): number {
  let largest = actual.length === expected.length ? 0 : 255;
  actual.forEach((row, y) => {
    const stored = expected[y] ?? [];
    if (stored.length !== row.length) largest = 255;
    row.forEach((value, x) => {
      largest = Math.max(largest, Math.abs(value - (stored[x] ?? 255)));
    });
  });
  return largest;
}

async function expectPixelSnapshot(name: string, surface: CanvasRenderingContext2D): Promise<void> {
  const path = `src/effects/__pixels__/${name}.json`;
  const actual = alphaGrid(surface);
  const serialized = `[\n${actual.map((row) => `  ${JSON.stringify(row)}`).join(',\n')}\n]\n`;
  const update = server.config.snapshotOptions.updateSnapshot;
  let stored: string | undefined;
  try {
    stored = await commands.readFile(path);
  } catch {
    stored = undefined;
  }
  if (stored === undefined || update === 'all') {
    expect(
      stored !== undefined || update !== 'none',
      `The pixel snapshot "${path}" is missing.`,
    ).toBe(true);
    await commands.writeFile(path, serialized);
    return;
  }
  expect(largestDifference(actual, JSON.parse(stored) as number[][])).toBeLessThanOrEqual(
    PIXEL_TOLERANCE,
  );
}

function pixels(surface: CanvasRenderingContext2D): Uint8ClampedArray {
  return surface.getImageData(0, 0, WIDTH, HEIGHT).data;
}

describe('glow sprites', () => {
  it('draws two tinted sprites with the aspect ratio of the shapes', () => {
    const sprites = createGlowSprites((width, height) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      return canvas;
    }, '#00ffff');
    expect(sprites.map(({ width, height }) => [width, height])).toEqual([
      [128, 89],
      [128, 82],
    ]);
    for (const sprite of sprites) {
      const surface = context2d(sprite);
      const whole = stats(surface, 0, 0, sprite.width, sprite.height);
      expect(whole.painted).toBeGreaterThan(sprite.width * sprite.height * 0.2);
      expect(whole.maxAlpha).toBeGreaterThan(100);
      expect(whole.mean.r).toBeLessThan(10);
      expect(whole.mean.g).toBeGreaterThan(200);
      expect(whole.mean.b).toBeGreaterThan(200);
      const corner = stats(surface, 0, 0, 4, 4);
      expect(corner.maxAlpha).toBeLessThan(20);
    }
  });
});

describe('effect rendering', () => {
  it('renders soft red clouds near the pointer', () => {
    const surface = renderCloud();
    const near = stats(surface, 50, 20, 200, 180);
    expect(near.painted).toBeGreaterThan(1000);
    expect(near.maxAlpha).toBeGreaterThan(5);
    expect(near.maxAlpha).toBeLessThan(200);
    expect(near.mean.r).toBeGreaterThan(200);
    expect(near.mean.g).toBeLessThan(40);
    expect(stats(surface, 0, 0, 20, 20).painted).toBe(0);
  });

  it('renders an opaque green chalk core with a feathered edge', () => {
    const surface = renderChalk();
    const core = stats(surface, 148, 98, 4, 4);
    expect(core.maxAlpha).toBeGreaterThan(180);
    expect(core.mean.g).toBeGreaterThan(200);
    expect(core.mean.r).toBeLessThan(40);
    const edge = stats(surface, 148, 112, 4, 4);
    expect(edge.maxAlpha).toBeGreaterThan(0);
    expect(edge.maxAlpha).toBeLessThan(core.maxAlpha);
    expect(stats(surface, 148, 20, 4, 4).painted).toBe(0);
    expect(stats(surface, 0, 90, 20, 20).painted).toBe(0);
  });

  it('renders magenta glitter around the burst', () => {
    const surface = renderGlitter();
    const near = stats(surface, 100, 50, 100, 100);
    expect(near.painted).toBeGreaterThan(50);
    expect(near.maxAlpha).toBeGreaterThan(30);
    expect(near.mean.r).toBeGreaterThan(150);
    expect(near.mean.b).toBeGreaterThan(150);
    expect(near.mean.g).toBeLessThan(40);
    expect(stats(surface, 0, 0, 30, 30).painted).toBe(0);
  });

  it.each([
    ['cloud', renderCloud],
    ['chalk', renderChalk],
    ['glitter', renderGlitter],
  ] as const)('matches the seeded pixel snapshot of the %s effect', async (name, render) => {
    await expectPixelSnapshot(name, render());
  });

  it('renders the same pixels for the same seed', () => {
    for (const render of [renderCloud, renderChalk, renderGlitter]) {
      expect(pixels(render())).toEqual(pixels(render()));
    }
  });
});
