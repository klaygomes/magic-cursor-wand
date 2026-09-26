import { describe, expect, it } from 'vitest';
import type { Frame } from '../core/types';
import { chalkEffect, chalkSchema } from './chalk';
import { createFakeCanvas, createTestContext, defaultsOf, frameAt, pointerAt } from './testing';

const THEME = { color: '#ffffff', motion: 'auto', maxDpr: 2 } as const;

function setup(overrides: Partial<ReturnType<typeof defaultsOf<typeof chalkSchema>>> = {}) {
  const context = createTestContext({ seed: 9, createCanvas: () => createFakeCanvas().canvas });
  const effect = chalkEffect();
  effect.setup(context);
  effect.configure({ ...defaultsOf(chalkSchema), ...overrides }, THEME);
  return { effect, context };
}

function arcs(effect: ReturnType<typeof chalkEffect>, frame: Frame) {
  const target = createFakeCanvas();
  effect.draw(target.context, frame);
  return {
    target,
    arcs: target.calls
      .filter((call) => call.method === 'arc')
      .map((call) => call.args as [number, number, number]),
  };
}

function drawStroke(effect: ReturnType<typeof chalkEffect>, from: number, to: number, y = 50) {
  effect.pointer?.(pointerAt('down', from, y));
  for (let x = from + 5; x <= to; x += 5) {
    effect.pointer?.(pointerAt('move', x, y, { samples: [{ x, y }] }));
  }
}

describe('chalkEffect', () => {
  it('has the layer, the composite and the demo defaults', () => {
    const effect = chalkEffect();
    expect(effect.name).toBe('chalk');
    expect(effect.layer).toBe(10);
    expect(effect.composite).toBe('source-over');
    expect(defaultsOf(chalkSchema)).toEqual({
      size: 15,
      maxLength: 600,
      smoothing: 0.75,
      softness: 0.5,
      taper: 0.6,
      fadeRate: 0.005,
      color: '#ffffff',
    });
  });

  it('emits a burst at the start of a stroke', () => {
    const { effect, context } = setup();
    effect.pointer?.(pointerAt('down', 10, 20));
    expect(context.bus.bursts).toEqual([{ x: 10, y: 20, strength: 1 }]);
    expect(effect.isIdle()).toBe(false);
  });

  it('starts no stroke for a press that does not draw', () => {
    const { effect, context } = setup();
    effect.pointer?.(pointerAt('down', 10, 20, { drawing: false }));
    effect.pointer?.(pointerAt('move', 40, 20, { drawing: false }));
    effect.update(frameAt(0));
    expect(context.bus.bursts).toHaveLength(0);
    expect(effect.isIdle()).toBe(true);
  });

  it('adds the coalesced samples directly when the smoothing is 0', () => {
    const { effect } = setup({ smoothing: 0, taper: 0 });
    drawStroke(effect, 0, 100);
    effect.update(frameAt(0));
    const { arcs: circles, target } = arcs(effect, frameAt(0));
    expect(circles.length).toBeGreaterThan(0);
    const xs = circles.map(([x]) => x);
    expect(Math.min(...xs)).toBeCloseTo(0, 5);
    expect(Math.max(...xs)).toBeCloseTo(100, 5);
    for (const [, y] of circles) expect(y).toBe(50);
    expect(target.context.fillStyle).toBe('#ffffff');
  });

  it('moves the smoothed pen toward the pointer in each frame', () => {
    const { effect } = setup({ smoothing: 0.75 });
    effect.pointer?.(pointerAt('down', 0, 50));
    effect.pointer?.(pointerAt('move', 100, 50));
    effect.update(frameAt(0));
    const first = Math.max(...arcs(effect, frameAt(0)).arcs.map(([x]) => x));
    expect(first).toBeCloseTo(25, 5);
    effect.update(frameAt(1));
    const second = Math.max(...arcs(effect, frameAt(1)).arcs.map(([x]) => x));
    expect(second).toBeCloseTo(43.75, 5);
  });

  it('dissolves the oldest part of a stroke longer than the maximum length', () => {
    const { effect } = setup({ smoothing: 0, maxLength: 50, taper: 0 });
    drawStroke(effect, 0, 300);
    effect.update(frameAt(0));
    const xs = arcs(effect, frameAt(0)).arcs.map(([x]) => x);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(248);
    expect(Math.max(...xs)).toBeCloseTo(300, 5);
  });

  it('makes the tips thinner than the middle with taper', () => {
    const { effect } = setup({ smoothing: 0, taper: 1, softness: 0 });
    drawStroke(effect, 0, 200);
    effect.update(frameAt(0));
    const circles = arcs(effect, frameAt(0)).arcs;
    const radiusAt = (x: number) =>
      Math.max(...circles.filter(([cx]) => Math.abs(cx - x) < 3).map(([, , r]) => r));
    expect(radiusAt(0)).toBeLessThan(radiusAt(100) / 4);
    expect(radiusAt(200)).toBeLessThan(radiusAt(100) / 4);
  });

  it('vanishes a finished stroke with drift and glitter bursts, then becomes idle', () => {
    const { effect, context } = setup({ smoothing: 0, fadeRate: 0.005 });
    drawStroke(effect, 0, 100);
    effect.pointer?.(pointerAt('up', 100, 50));
    const bursts = context.bus.bursts.length;
    effect.update(frameAt(0));
    for (let i = 1; i < 20; i++) effect.update(frameAt(i));
    const drifted = arcs(effect, frameAt(20)).arcs;
    expect(drifted.some(([, y]) => y < 50)).toBe(true);
    for (let i = 20; i < 400 && !effect.isIdle(); i++) effect.update(frameAt(i));
    expect(effect.isIdle()).toBe(true);
    expect(context.bus.bursts.length).toBeGreaterThan(bursts);
  });

  it('fades without drift and without bursts under reduced motion', () => {
    const { effect, context } = setup({ smoothing: 0, fadeRate: 0.005, taper: 0 });
    drawStroke(effect, 0, 100);
    effect.pointer?.(pointerAt('up', 100, 50));
    const bursts = context.bus.bursts.length;
    const reduced = (i: number) => frameAt(i, { reducedMotion: true });
    for (let i = 0; i < 20; i++) effect.update(reduced(i));
    const { arcs: circles, target } = arcs(effect, reduced(20));
    expect(circles.length).toBeGreaterThan(0);
    for (const [x, y] of circles) {
      expect(y).toBe(50);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(100);
    }
    const alphas = target.calls.filter((call) => call.method === 'fill').map((c) => c.globalAlpha);
    expect(Math.max(...alphas)).toBeLessThan(0.485);
    for (let i = 20; i < 400 && !effect.isIdle(); i++) effect.update(reduced(i));
    expect(effect.isIdle()).toBe(true);
    expect(context.bus.bursts.length).toBe(bursts);
  });

  it('makes a short dot and a burst for a tap', () => {
    const { effect, context } = setup();
    effect.pointer?.(pointerAt('tap', 30, 40, { pointerType: 'touch', drawing: true }));
    expect(context.bus.bursts).toEqual([{ x: 30, y: 40, strength: 1 }]);
    effect.update(frameAt(0));
    const circles = arcs(effect, frameAt(0)).arcs;
    expect(circles.length).toBeGreaterThan(0);
    for (const [x, y] of circles) {
      expect(x).toBeGreaterThanOrEqual(30);
      expect(x).toBeLessThanOrEqual(40);
      expect(Math.abs(y - 40)).toBeLessThan(1);
    }
    for (let i = 1; i < 600 && !effect.isIdle(); i++) effect.update(frameAt(i));
    expect(effect.isIdle()).toBe(true);
  });

  it('makes only a burst for a tap that does not draw', () => {
    const { effect, context } = setup();
    effect.pointer?.(pointerAt('tap', 30, 40, { pointerType: 'touch', drawing: false }));
    expect(context.bus.bursts).toEqual([{ x: 30, y: 40, strength: 1 }]);
    expect(effect.isIdle()).toBe(true);
  });

  it('ends the stroke on cancel and on leave', () => {
    for (const phase of ['cancel', 'leave'] as const) {
      const { effect } = setup({ smoothing: 0, fadeRate: 0.05 });
      drawStroke(effect, 0, 40);
      effect.pointer?.(pointerAt(phase, 40, 50));
      for (let i = 0; i < 400 && !effect.isIdle(); i++) effect.update(frameAt(i));
      expect(effect.isIdle()).toBe(true);
    }
  });

  it('removes all strokes on clear', () => {
    const { effect } = setup();
    drawStroke(effect, 0, 40);
    effect.clear();
    expect(effect.isIdle()).toBe(true);
  });

  it('emits the same bursts for the same seed', () => {
    const run = () => {
      const { effect, context } = setup({ smoothing: 0 });
      drawStroke(effect, 0, 200);
      effect.pointer?.(pointerAt('up', 200, 50));
      for (let i = 0; i < 100; i++) effect.update(frameAt(i));
      return context.bus.bursts;
    };
    expect(run()).toEqual(run());
  });
});
