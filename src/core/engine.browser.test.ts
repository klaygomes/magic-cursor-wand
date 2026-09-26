import { afterEach, describe, expect, it } from 'vitest';
import type { WandError } from '../config/types';
import type { AnyConfig } from './engine';
import { createManualScheduler } from './scheduler';
import { createTestWand, type DrawRecord, fakeEffect } from './test-support';
import type { Plugin, PluginContext, Wand } from './types';

const wands: Wand<AnyConfig>[] = [];
const elements: HTMLElement[] = [];

function last<T>(items: readonly T[]): T | undefined {
  return items[items.length - 1];
}

function track(wand: Wand<AnyConfig>): Wand<AnyConfig> {
  wands.push(wand);
  return wand;
}

function box(): HTMLElement {
  const element = document.createElement('div');
  element.style.width = '300px';
  element.style.height = '200px';
  element.style.overflow = 'auto';
  const content = document.createElement('div');
  content.style.height = '1000px';
  content.style.width = '1000px';
  element.appendChild(content);
  document.body.appendChild(element);
  elements.push(element);
  return element;
}

function pointer(target: EventTarget, type: string, init: PointerEventInit = {}): PointerEvent {
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
    button: 0,
    buttons: type === 'pointerdown' || type === 'pointermove' ? 1 : 0,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

afterEach(() => {
  for (const wand of wands.splice(0)) wand.destroy();
  for (const element of elements.splice(0)) element.remove();
});

describe('surface', () => {
  it('attaches a fixed overlay canvas that does not take pointer events', () => {
    const wand = track(createTestWand({ scheduler: createManualScheduler(), silent: true }));
    const canvas = document.body.querySelector('canvas');
    expect(canvas).not.toBeNull();
    expect(canvas?.style.position).toBe('fixed');
    expect(canvas?.style.pointerEvents).toBe('none');
    expect(canvas?.style.zIndex).toBe('2147483647');
    wand.destroy();
    expect(document.body.querySelector('canvas')).toBeNull();
  });

  it('sets the canvas size from the pixel ratio and theme.maxDpr', () => {
    track(
      createTestWand({
        scheduler: createManualScheduler(),
        config: { theme: { maxDpr: 1 } },
      }),
    );
    const canvas = document.body.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas.width).toBe(document.documentElement.clientWidth);
  });

  it('attaches an absolute canvas in the container and restores the target styles', () => {
    const target = box();
    const wand = track(
      createTestWand({ target, scheduler: createManualScheduler(), zIndex: 5, silent: true }),
    );
    const canvas = target.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas.style.position).toBe('absolute');
    expect(canvas.style.zIndex).toBe('5');
    expect(canvas.style.width).toBe(`${target.clientWidth}px`);
    expect(target.style.position).toBe('relative');
    expect(target.style.touchAction).toBe('none');
    wand.destroy();
    expect(target.querySelector('canvas')).toBeNull();
    expect(target.style.position).toBe('');
    expect(target.style.touchAction).toBe('');
  });

  it('uses the touchAction option in container mode', () => {
    const target = box();
    track(createTestWand({ target, touchAction: 'pan-y', scheduler: createManualScheduler() }));
    expect(target.style.touchAction).toBe('pan-y');
  });

  it('throws a clear error for a second overlay', () => {
    const first = track(createTestWand({ scheduler: createManualScheduler() }));
    expect(() => createTestWand({ scheduler: createManualScheduler() })).toThrow(
      /Only one overlay wand can exist at a time/,
    );
    track(createTestWand({ target: box(), scheduler: createManualScheduler() }));
    first.destroy();
    expect(() => track(createTestWand({ scheduler: createManualScheduler() }))).not.toThrow();
  });
});

describe('frame loop', () => {
  it('draws the effects in layer order and resets the canvas state before each draw', () => {
    const scheduler = createManualScheduler();
    const draws: DrawRecord[] = [];
    const effects = [
      fakeEffect('top', 20, draws, 'lighter'),
      fakeEffect('bottom', 0, draws),
      fakeEffect('middle', 10, draws),
    ];
    track(createTestWand({ effects, scheduler, config: { theme: { maxDpr: 1 } } }));
    scheduler.advance();
    expect(draws.map((record) => record.name)).toEqual(['bottom', 'middle', 'top']);
    for (const record of draws) {
      expect(record.alpha).toBe(1);
      expect(record.transform.e).toBeCloseTo(-window.scrollX);
      expect(record.transform.f).toBeCloseTo(-window.scrollY);
    }
    expect(draws.map((record) => record.composite)).toEqual([
      'source-over',
      'source-over',
      'lighter',
    ]);
  });

  it('normalizes dt to 60 fps and clamps it at 3', () => {
    const scheduler = createManualScheduler();
    const effect = fakeEffect('fx');
    track(createTestWand({ effects: [effect], scheduler }));
    scheduler.advance(1000 / 30);
    scheduler.advance(1000);
    expect(effect.frames[0]?.dt).toBeCloseTo(2);
    expect(effect.frames[1]?.dt).toBe(3);
  });

  it('disables an effect after three failures in sequence and emits one effect error', () => {
    const scheduler = createManualScheduler();
    const broken = fakeEffect('broken');
    const healthy = fakeEffect('healthy');
    broken.throwOnDraw = true;
    const wand = track(createTestWand({ effects: [broken, healthy], scheduler, silent: true }));
    const errors: WandError[] = [];
    wand.on('error', (error) => errors.push(error));
    scheduler.frames(2);
    expect(errors).toHaveLength(0);
    scheduler.frames(3);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ kind: 'effect', source: 'broken' });
    expect(errors[0]?.message).toContain('disabled');
    expect(broken.cleared).toBe(1);
    expect(broken.frames).toHaveLength(3);
    expect(healthy.frames).toHaveLength(5);
  });

  it('resets the failure count after a frame without an error', () => {
    const scheduler = createManualScheduler();
    const effect = fakeEffect('flaky');
    const wand = track(createTestWand({ effects: [effect], scheduler, silent: true }));
    const errors: WandError[] = [];
    wand.on('error', (error) => errors.push(error));
    effect.throwOnDraw = true;
    scheduler.frames(2);
    effect.throwOnDraw = false;
    scheduler.advance();
    effect.throwOnDraw = true;
    scheduler.frames(2);
    expect(errors).toHaveLength(0);
  });

  it('writes one console warning for each source unless silent', () => {
    const scheduler = createManualScheduler();
    const effect = fakeEffect('noisy');
    const warnings: unknown[][] = [];
    const original = console.warn;
    console.warn = (...args: unknown[]) => warnings.push(args);
    try {
      track(createTestWand({ effects: [effect], scheduler }));
      effect.context?.reportError(new Error('one'));
      effect.context?.reportError(new Error('two'));
    } finally {
      console.warn = original;
    }
    expect(warnings).toHaveLength(1);
  });

  it('emits the errors that a plugin reports', () => {
    const scheduler = createManualScheduler();
    const cause = new Error('Load failed.');
    let context: PluginContext | undefined;
    const plugin: Plugin = {
      name: 'widget',
      schema: {},
      setup(pluginContext) {
        context = pluginContext;
      },
    };
    const wand = track(createTestWand({ plugins: [plugin], scheduler, silent: true }));
    const errors: WandError[] = [];
    wand.on('error', (error) => errors.push(error));
    context?.reportError(cause);
    expect(errors).toEqual([
      {
        kind: 'effect',
        source: 'widget',
        message: 'The section "widget" failed. The engine continues to operate.',
        cause,
      },
    ]);
  });

  it('sleeps when all effects are idle and wakes on pointer input', () => {
    const scheduler = createManualScheduler();
    const effect = fakeEffect('fx');
    effect.idle = true;
    track(createTestWand({ effects: [effect], scheduler }));
    scheduler.advance();
    expect(scheduler.pending).toBe(0);
    expect(effect.frames).toHaveLength(0);
    pointer(window, 'pointermove', { clientX: 10, clientY: 20 });
    expect(scheduler.pending).toBe(1);
    scheduler.advance();
    expect(effect.frames).toHaveLength(1);
    pointer(window, 'pointerout', { relatedTarget: null });
    scheduler.advance();
    expect(scheduler.pending).toBe(0);
  });

  it('calls clear when an effect becomes disabled and skips it after', () => {
    const scheduler = createManualScheduler();
    const effect = fakeEffect('fx');
    const wand = track(createTestWand({ effects: [effect], scheduler }));
    scheduler.advance();
    wand.setConfig({ fx: { enabled: false } });
    scheduler.frames(3);
    expect(effect.cleared).toBe(1);
    expect(effect.frames).toHaveLength(1);
    wand.setConfig({ fx: { enabled: true } });
    scheduler.advance();
    expect(effect.frames).toHaveLength(2);
  });

  it('resolves a null color to the theme color before configure', () => {
    const scheduler = createManualScheduler();
    const effect = fakeEffect('fx');
    const wand = track(createTestWand({ effects: [effect], scheduler }));
    expect(last(effect.configured)).toEqual({ size: 5, tint: '#ffffff' });
    wand.setConfig({ theme: { color: '#ff0000' } });
    expect(last(effect.configured)).toEqual({ size: 5, tint: '#ff0000' });
    wand.setConfig({ fx: { tint: '#00ff00' } });
    expect(last(effect.configured)).toEqual({ size: 5, tint: '#00ff00' });
  });

  it('gives reducedMotion to the frame and stops for motion off', () => {
    const scheduler = createManualScheduler();
    const effect = fakeEffect('fx');
    const wand = track(
      createTestWand({ effects: [effect], scheduler, config: { theme: { motion: 'reduced' } } }),
    );
    scheduler.advance();
    expect(effect.frames[0]?.reducedMotion).toBe(true);
    wand.setConfig({ theme: { motion: 'off' } });
    expect(scheduler.pending).toBe(0);
    wand.setConfig({ theme: { motion: 'full' } });
    scheduler.advance();
    expect(effect.frames[1]?.reducedMotion).toBe(false);
  });

  it('follows prefers-reduced-motion for motion auto and its changes', () => {
    const query = Object.assign(new EventTarget(), {
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
    });
    const original = window.matchMedia;
    window.matchMedia = () => query as unknown as MediaQueryList;
    try {
      const scheduler = createManualScheduler();
      const effect = fakeEffect('fx');
      track(createTestWand({ effects: [effect], scheduler }));
      scheduler.advance();
      expect(effect.frames[0]?.reducedMotion).toBe(true);
      query.matches = false;
      query.dispatchEvent(new Event('change'));
      scheduler.advance();
      expect(effect.frames[1]?.reducedMotion).toBe(false);
    } finally {
      window.matchMedia = original;
    }
  });

  it('delays the first frame for startAfter in milliseconds', () => {
    const scheduler = createManualScheduler();
    const effect = fakeEffect('fx');
    track(createTestWand({ effects: [effect], scheduler, startAfter: 100 }));
    scheduler.frames(5);
    expect(effect.frames).toHaveLength(0);
    scheduler.frames(2);
    expect(effect.frames.length).toBeGreaterThan(0);
  });

  it('delays the first frame until ready for startAfter ready', async () => {
    const scheduler = createManualScheduler();
    const effect = fakeEffect('fx');
    const wand = track(createTestWand({ effects: [effect], scheduler, startAfter: 'ready' }));
    expect(scheduler.pending).toBe(0);
    await wand.ready;
    scheduler.advance();
    expect(effect.frames).toHaveLength(1);
  });

  it('stops and starts the loop', () => {
    const scheduler = createManualScheduler();
    const effect = fakeEffect('fx');
    const wand = track(createTestWand({ effects: [effect], scheduler }));
    wand.stop();
    expect(scheduler.pending).toBe(0);
    wand.start();
    scheduler.advance();
    expect(effect.frames).toHaveLength(1);
  });

  it('shares one frame request between instances with the same scheduler', () => {
    const scheduler = createManualScheduler();
    const first = fakeEffect('first');
    const second = fakeEffect('second');
    track(createTestWand({ effects: [first], scheduler }));
    const other = track(createTestWand({ effects: [second], scheduler, target: box() }));
    expect(scheduler.pending).toBe(1);
    scheduler.advance();
    expect(first.frames).toHaveLength(1);
    expect(second.frames).toHaveLength(1);
    other.destroy();
    scheduler.advance();
    expect(first.frames).toHaveLength(2);
    expect(second.frames).toHaveLength(1);
  });

  it('dispatches bus events between effects', () => {
    const scheduler = createManualScheduler();
    const emitter = fakeEffect('emitter');
    const listener = fakeEffect('listener');
    track(createTestWand({ effects: [emitter, listener], scheduler }));
    const received: number[] = [];
    listener.context?.bus.on('burst', ({ strength }) => received.push(strength));
    emitter.context?.bus.emit('burst', { x: 1, y: 2, strength: 3 });
    expect(received).toEqual([3]);
  });

  it('gives the seeded random function to the effects', () => {
    const effect = fakeEffect('fx');
    track(
      createTestWand({ effects: [effect], scheduler: createManualScheduler(), random: () => 0.5 }),
    );
    expect(effect.context?.random()).toBe(0.5);
  });
});

describe('scroll anchoring', () => {
  it('keeps overlay positions in document coordinates and translates each frame', () => {
    const spacer = document.createElement('div');
    spacer.style.height = '5000px';
    document.body.appendChild(spacer);
    elements.push(spacer);
    window.scrollTo(0, 120);
    const scheduler = createManualScheduler();
    const draws: DrawRecord[] = [];
    const effect = fakeEffect('fx', 0, draws);
    effect.idle = true;
    track(createTestWand({ effects: [effect], scheduler, config: { theme: { maxDpr: 1 } } }));
    scheduler.advance();
    expect(scheduler.pending).toBe(0);
    window.dispatchEvent(new Event('scroll'));
    expect(scheduler.pending).toBe(1);
    pointer(window, 'pointermove', { clientX: 10, clientY: 30 });
    expect(last(effect.pointers)).toMatchObject({
      x: 10 + window.scrollX,
      y: 30 + window.scrollY,
    });
    scheduler.advance();
    expect(last(draws)?.frame.scrollY).toBe(window.scrollY);
    expect(last(draws)?.transform.f).toBe(-window.scrollY);
    window.scrollTo(0, 0);
  });

  it('keeps container positions in element coordinates plus the element scroll', () => {
    const target = box();
    const scheduler = createManualScheduler();
    const draws: DrawRecord[] = [];
    const effect = fakeEffect('fx', 0, draws);
    track(
      createTestWand({ effects: [effect], scheduler, target, config: { theme: { maxDpr: 1 } } }),
    );
    target.scrollTop = 100;
    target.dispatchEvent(new Event('scroll'));
    const canvas = target.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas.style.top).toBe('100px');
    const rect = target.getBoundingClientRect();
    pointer(target, 'pointermove', { clientX: rect.left + 10, clientY: rect.top + 20 });
    expect(last(effect.pointers)?.x).toBeCloseTo(10);
    expect(last(effect.pointers)?.y).toBeCloseTo(120);
    scheduler.advance();
    expect(last(draws)?.frame.scrollY).toBe(100);
    expect(last(draws)?.transform.f).toBe(-100);
  });
});
