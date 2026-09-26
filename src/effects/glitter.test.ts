import { describe, expect, it } from 'vitest';
import { glitterEffect, glitterSchema } from './glitter';
import { createFakeCanvas, createTestContext, defaultsOf, frameAt } from './testing';

const THEME = { color: '#ffffff', motion: 'auto', maxDpr: 2 } as const;

function setup(overrides: Partial<ReturnType<typeof defaultsOf<typeof glitterSchema>>> = {}) {
  const sprite = createFakeCanvas(20, 10).canvas;
  const context = createTestContext({ seed: 5, createCanvas: () => createFakeCanvas().canvas });
  const effect = glitterEffect({ sprite });
  effect.setup(context);
  effect.configure({ ...defaultsOf(glitterSchema), ...overrides }, THEME);
  return { effect, context, sprite };
}

function drawCalls(effect: ReturnType<typeof glitterEffect>, index: number) {
  const target = createFakeCanvas();
  effect.draw(target.context, frameAt(index));
  return target.calls.filter((call) => call.method === 'drawImage');
}

describe('glitterEffect', () => {
  it('has the layer, the composite and the demo defaults', () => {
    const effect = glitterEffect();
    expect(effect.name).toBe('glitter');
    expect(effect.layer).toBe(20);
    expect(effect.composite).toBe('lighter');
    expect(defaultsOf(glitterSchema)).toEqual({
      size: 6,
      spawnRate: 3,
      gravity: 0.02,
      friction: 0.94,
      fadeRate: 0.015,
      twinkle: 5,
      color: '#ffffff',
      maxParticles: 979,
    });
  });

  it('spawns from 4 to 5 particles for each burst with a spawn rate of 4', () => {
    for (let seed = 0; seed < 5; seed++) {
      const { effect, context } = setup({ spawnRate: 4, twinkle: 1 });
      for (let i = 0; i < seed; i++) context.random();
      context.bus.emit('burst', { x: 50, y: 50, strength: 1 });
      const count = drawCalls(effect, 0).length;
      expect(count).toBeGreaterThanOrEqual(1);
      expect(count).toBeLessThanOrEqual(5);
    }
  });

  it('keeps the number of particles at or below the maximum', () => {
    const { effect, context } = setup({ maxParticles: 10, twinkle: 1 });
    for (let i = 0; i < 20; i++) context.bus.emit('burst', { x: 50, y: 50, strength: 1 });
    effect.update(frameAt(0));
    expect(drawCalls(effect, 0).length).toBeLessThanOrEqual(10);
  });

  it('draws the custom sprite with its aspect ratio around the particle', () => {
    const { effect, context, sprite } = setup({ twinkle: 1 });
    context.bus.emit('burst', { x: 50, y: 50, strength: 1 });
    const calls = drawCalls(effect, 0);
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      const [image, x, y, width, height] = call.args as [unknown, number, number, number, number];
      expect(image).toBe(sprite);
      expect(height).toBeCloseTo(width / 2, 6);
      expect(x).toBeCloseTo(-width / 2, 6);
      expect(y).toBeCloseTo(-height / 2, 6);
      expect(call.globalAlpha).toBeGreaterThanOrEqual(0.01);
      expect(call.globalAlpha).toBeLessThanOrEqual(1);
    }
  });

  it('moves the particles with gravity and restores the base transform', () => {
    const { effect, context } = setup({ twinkle: 1, gravity: 0.2, friction: 1 });
    context.bus.emit('burst', { x: 50, y: 50, strength: 1 });
    for (let i = 0; i < 30; i++) effect.update(frameAt(i));
    const target = createFakeCanvas();
    effect.draw(target.context, frameAt(30));
    const transforms = target.calls.filter((call) => call.method === 'setTransform');
    const translations = transforms.slice(0, -1).map((call) => call.args[5] as number);
    expect(translations.every((y) => y > 50)).toBe(true);
    expect(transforms[transforms.length - 1]?.args[0]).toEqual({
      a: 1,
      b: 0,
      c: 0,
      d: 1,
      e: 0,
      f: 0,
    });
  });

  it('removes the particles when their life ends and becomes idle', () => {
    const { effect, context } = setup({ fadeRate: 0.05 });
    context.bus.emit('burst', { x: 50, y: 50, strength: 1 });
    expect(effect.isIdle()).toBe(false);
    for (let i = 0; i < 100; i++) effect.update(frameAt(i));
    expect(effect.isIdle()).toBe(true);
  });

  it('ignores bursts and removes particles with reduced motion', () => {
    const { effect, context } = setup();
    context.bus.emit('burst', { x: 50, y: 50, strength: 1 });
    effect.update(frameAt(0, { reducedMotion: true }));
    expect(effect.isIdle()).toBe(true);
    context.bus.emit('burst', { x: 50, y: 50, strength: 1 });
    expect(effect.isIdle()).toBe(true);
  });

  it('stops the listener on destroy', () => {
    const { effect, context } = setup();
    effect.destroy();
    context.bus.emit('burst', { x: 50, y: 50, strength: 1 });
    expect(effect.isIdle()).toBe(true);
  });

  it('removes the particles on clear', () => {
    const { effect, context } = setup();
    context.bus.emit('burst', { x: 50, y: 50, strength: 1 });
    effect.clear();
    expect(effect.isIdle()).toBe(true);
  });
});
