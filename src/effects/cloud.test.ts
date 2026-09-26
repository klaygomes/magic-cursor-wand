import { describe, expect, it } from 'vitest';
import { cloudEffect, cloudSchema } from './cloud';
import { createFakeCanvas, createTestContext, defaultsOf, frameAt, pointerAt } from './testing';

const THEME = { color: '#ffffff', motion: 'auto', maxDpr: 2 } as const;

function setup(overrides: Partial<ReturnType<typeof defaultsOf<typeof cloudSchema>>> = {}) {
  const sprites: ReturnType<typeof createFakeCanvas>[] = [];
  const context = createTestContext({
    seed: 42,
    createCanvas: (width, height) => {
      const fake = createFakeCanvas(width, height);
      sprites.push(fake);
      return fake.canvas;
    },
  });
  const effect = cloudEffect();
  effect.setup(context);
  effect.configure({ ...defaultsOf(cloudSchema), ...overrides }, THEME);
  const target = createFakeCanvas();
  return { effect, context, sprites, target };
}

describe('cloudEffect', () => {
  it('has the layer, the composite and the demo defaults', () => {
    const effect = cloudEffect();
    expect(effect.name).toBe('cloud');
    expect(effect.layer).toBe(0);
    expect(effect.composite).toBe('source-over');
    expect(defaultsOf(cloudSchema)).toEqual({
      size: 18,
      density: 0.5,
      bounce: 150,
      spread: 50,
      fadeRate: 0.035,
      color: '#fad30b',
      maxClouds: 348,
    });
  });

  it('spawns no cloud while the pointer is not active', () => {
    const { effect } = setup();
    for (let i = 0; i < 60; i++) effect.update(frameAt(i));
    expect(effect.isIdle()).toBe(true);
  });

  it('spawns clouds near the pointer and draws them with a low alpha', () => {
    const { effect, target } = setup({ density: 1, bounce: 60, spread: 30 });
    effect.pointer?.(pointerAt('move', 100, 80, { drawing: false }));
    for (let i = 0; i < 10; i++) effect.update(frameAt(i));
    expect(effect.isIdle()).toBe(false);
    effect.draw(target.context, frameAt(10));
    const draws = target.calls.filter((call) => call.method === 'drawImage');
    expect(draws.length).toBeGreaterThan(0);
    for (const call of draws) {
      const [, x, y, width] = call.args as number[];
      const center = { x: (x ?? 0) + (width ?? 0) / 2, y: (y ?? 0) + (width ?? 0) / 2 };
      expect(Math.abs(center.x - 100)).toBeLessThan(15 + 30 + 1);
      expect(center.y).toBeLessThan(80 + 15 + 30 + 1);
      expect(call.globalAlpha).toBeGreaterThan(0);
      expect(call.globalAlpha).toBeLessThanOrEqual(0.1);
    }
  });

  it('keeps the number of clouds at or below the maximum', () => {
    const { effect, target } = setup({ density: 1, maxClouds: 5, fadeRate: 0.001 });
    effect.pointer?.(pointerAt('move', 50, 50, { drawing: false }));
    for (let i = 0; i < 40; i++) effect.update(frameAt(i));
    effect.draw(target.context, frameAt(40));
    expect(target.calls.filter((call) => call.method === 'drawImage').length).toBeLessThanOrEqual(
      5,
    );
  });

  it('stops the spawn when the pointer leaves and becomes idle when all clouds fade', () => {
    const { effect } = setup({ density: 1, fadeRate: 0.05 });
    effect.pointer?.(pointerAt('move', 50, 50, { drawing: false }));
    for (let i = 0; i < 5; i++) effect.update(frameAt(i));
    effect.pointer?.(pointerAt('leave', 50, 50, { drawing: false }));
    for (let i = 5; i < 200; i++) effect.update(frameAt(i));
    expect(effect.isIdle()).toBe(true);
  });

  it('keeps the spawn after a mouse button release', () => {
    const { effect } = setup({ density: 1 });
    effect.pointer?.(pointerAt('down', 50, 50));
    effect.pointer?.(pointerAt('up', 50, 50));
    effect.update(frameAt(0));
    expect(effect.isIdle()).toBe(false);
  });

  it('removes all clouds and spawns none with reduced motion', () => {
    const { effect } = setup({ density: 1 });
    effect.pointer?.(pointerAt('move', 50, 50, { drawing: false }));
    effect.update(frameAt(0));
    expect(effect.isIdle()).toBe(false);
    effect.update(frameAt(1, { reducedMotion: true }));
    expect(effect.isIdle()).toBe(true);
  });

  it('rebuilds the sprite only when the color changes', () => {
    const { effect, sprites, target } = setup({ density: 1 });
    effect.pointer?.(pointerAt('move', 50, 50, { drawing: false }));
    effect.update(frameAt(0));
    effect.draw(target.context, frameAt(0));
    effect.configure({ ...defaultsOf(cloudSchema), density: 0.5 }, THEME);
    effect.draw(target.context, frameAt(1));
    const gradients = () =>
      sprites[0]?.calls.filter((call) => call.method === 'createRadialGradient').length;
    expect(sprites).toHaveLength(1);
    expect(gradients()).toBe(1);
    effect.configure({ ...defaultsOf(cloudSchema), color: '#ff0000' }, THEME);
    effect.draw(target.context, frameAt(2));
    expect(gradients()).toBe(2);
  });

  it('gives the same clouds for the same seed', () => {
    const run = () => {
      const { effect, target } = setup({ density: 0.6 });
      effect.pointer?.(pointerAt('move', 120, 90, { drawing: false }));
      for (let i = 0; i < 30; i++) effect.update(frameAt(i));
      effect.draw(target.context, frameAt(30));
      return target.calls.map((call) => call.args.slice(1));
    };
    expect(run()).toEqual(run());
  });

  it('removes the clouds on clear and on destroy', () => {
    const { effect } = setup({ density: 1 });
    effect.pointer?.(pointerAt('move', 50, 50, { drawing: false }));
    effect.update(frameAt(0));
    effect.clear();
    expect(effect.isIdle()).toBe(true);
    effect.update(frameAt(1));
    effect.destroy();
    expect(effect.isIdle()).toBe(true);
  });
});
