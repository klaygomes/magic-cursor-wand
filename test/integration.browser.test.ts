import { afterEach, describe, expect, it, vi } from 'vitest';
import { createManualScheduler, createWand } from '../src';
import { startFromAttributes } from '../src/iife';

const wands: { destroy(): void }[] = [];

function track<W extends { destroy(): void }>(wand: W): W {
  wands.push(wand);
  return wand;
}

function pointer(type: string, x: number, y: number): void {
  document.body.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      button: 0,
      buttons: type === 'pointerup' ? 0 : 1,
      clientX: x,
      clientY: y,
    }),
  );
}

function stroke(): void {
  pointer('pointerdown', 100, 100);
  for (let step = 1; step <= 20; step++) pointer('pointermove', 100 + step * 10, 100 + step * 4);
}

function paintedPixels(): number {
  const canvas = document.querySelector('canvas');
  const context = canvas?.getContext('2d');
  if (!canvas || !context) return 0;
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  let painted = 0;
  for (let index = 3; index < data.length; index += 4) if ((data[index] ?? 0) > 0) painted++;
  return painted;
}

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

afterEach(() => {
  pointer('pointerup', 0, 0);
  for (const wand of wands.splice(0)) wand.destroy();
  document.body.innerHTML = '';
});

describe('createWand with the default effects', () => {
  it('draws pixels in overlay mode after a pointer stroke', () => {
    const scheduler = createManualScheduler();
    track(
      createWand({
        scheduler,
        random: seededRandom(7),
        silent: true,
        config: { theme: { motion: 'full' } },
      }),
    );
    expect(paintedPixels()).toBe(0);
    stroke();
    scheduler.frames(10);
    expect(paintedPixels()).toBeGreaterThan(0);
  });

  it('draws pixels with the default scheduler', async () => {
    track(createWand({ silent: true, config: { theme: { motion: 'full' } } }));
    stroke();
    await vi.waitFor(() => expect(paintedPixels()).toBeGreaterThan(0), { timeout: 2000 });
  });

  it('gives resolved values and the theme to the configuration', () => {
    const wand = track(createWand({ scheduler: createManualScheduler(), silent: true }));
    const config = wand.getConfig();
    expect(config.theme.color).toBe('#fad30b');
    expect(config.chalk.enabled).toBe(true);
    expect(wand.sections.map((section) => section.name)).toEqual([
      'theme',
      'cloud',
      'chalk',
      'glitter',
    ]);
  });
});

describe('script tag attributes', () => {
  it('does nothing without data-wand attributes', () => {
    expect(startFromAttributes({})).toBeUndefined();
    expect(document.querySelector('canvas')).toBeNull();
  });

  it('starts a wand with the storage provider and the cursor plugin', () => {
    const wand = startFromAttributes({ wandStorageKey: 'wand-test', wandCursor: 'replace' });
    expect(wand).toBeDefined();
    if (!wand) return;
    track(wand);
    expect(document.querySelector('canvas')).not.toBeNull();
    expect(wand.sections.map((section) => section.name)).toContain('cursor');
  });
});
