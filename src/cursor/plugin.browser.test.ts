import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ThemeConfig } from '../config/types';
import type {
  EffectConfig,
  PluginContext,
  SurfaceInfo,
  WandPointerEvent,
  WandPointerPhase,
} from '../core/types';
import { createFakeWand, type FakeWand } from '../panel/fake_wand';
import { type CursorPlugin, type CursorSchema, cursorPlugin } from './plugin';

interface Harness {
  readonly context: PluginContext;
  readonly wand: FakeWand;
  readonly pointerHandlers: Set<(event: WandPointerEvent) => void>;
  emit(phase: WandPointerPhase, x: number, y: number, pointerType?: string): void;
}

function createHarness(mode: SurfaceInfo['mode'] = 'overlay', element = document.body): Harness {
  const pointerHandlers = new Set<(event: WandPointerEvent) => void>();
  const wand = createFakeWand([], { cursor: { enabled: true } });
  const surface: SurfaceInfo = {
    mode,
    element,
    canvas: document.createElement('canvas'),
    toClient: (point) => ({ x: point.x - 5, y: point.y - 50 }),
  };
  const context: PluginContext = {
    wand,
    bus: { emit() {}, on: () => () => {} },
    surface,
    onPointer(handler) {
      pointerHandlers.add(handler);
      return () => {
        pointerHandlers.delete(handler);
      };
    },
    reportError(error) {
      throw error;
    },
  };
  return {
    context,
    wand,
    pointerHandlers,
    emit(phase, x, y, pointerType = 'mouse') {
      const event: WandPointerEvent = {
        phase,
        x,
        y,
        pointerType,
        drawing: phase === 'down',
        samples: [{ x, y }],
      };
      for (const handler of pointerHandlers) handler(event);
    },
  };
}

const config: EffectConfig<CursorSchema> = {
  glowSize: 100,
  glowStrength: 0.5,
  glowPress: 1.5,
  color: '#ff0000',
};
const fullMotion: ThemeConfig = { color: '#ffffff', motion: 'full', maxDpr: 2 };

function cursorRoot(): HTMLElement {
  const root = document.querySelector<HTMLElement>('[data-wand-cursor]');
  if (!root) throw new Error('The cursor element is not in the document.');
  return root;
}

function glowOf(root: HTMLElement): HTMLElement {
  return root.firstElementChild as HTMLElement;
}

function hoverOver(element: Element): void {
  element.dispatchEvent(
    new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse', composed: true }),
  );
}

describe('cursorPlugin', () => {
  let plugin: CursorPlugin;
  let harness: Harness;

  beforeEach(() => {
    vi.useFakeTimers();
    harness = createHarness();
  });

  afterEach(() => {
    plugin?.destroy?.();
    vi.useRealTimers();
    document.documentElement.style.cursor = '';
    document.body.replaceChildren();
  });

  it('has the cursor schema with the defaults of the demo', () => {
    plugin = cursorPlugin();
    expect(plugin.name).toBe('cursor');
    expect(plugin.schema.glowSize).toMatchObject({ default: 80, min: 0, max: 240, step: 2 });
    expect(plugin.schema.glowStrength).toMatchObject({ default: 0.55, min: 0, max: 1, step: 0.05 });
    expect(plugin.schema.glowPress).toMatchObject({ default: 1.25, min: 1, max: 2.5, step: 0.05 });
    expect(plugin.schema.color).toMatchObject({ default: null, nullable: true });
  });

  it('shows a glow that follows the pointer in glow mode', () => {
    plugin = cursorPlugin();
    plugin.setup(harness.context);
    plugin.configure?.(config, fullMotion);
    const root = cursorRoot();
    expect(root.style.opacity).toBe('0');
    expect(root.style.position).toBe('fixed');
    expect(root.style.pointerEvents).toBe('none');
    expect(root.querySelector('svg')).toBeNull();

    harness.emit('move', 105, 250);
    expect(root.style.transform).toBe('translate(100px, 200px)');
    expect(root.style.opacity).toBe('1');
    const glow = glowOf(root);
    expect(glow.style.width).toBe('100px');
    expect(glow.style.left).toBe('-50px');
    expect(glow.style.opacity).toBe('0.5');
    expect(glow.style.background).toContain('255, 0, 0');
    expect(document.documentElement.style.cursor).toBe('');
  });

  it('dims the glow after 1500 ms without movement and wakes it on the next move', () => {
    plugin = cursorPlugin();
    plugin.setup(harness.context);
    plugin.configure?.(config, fullMotion);
    harness.emit('move', 10, 60);
    const glow = glowOf(cursorRoot());
    vi.advanceTimersByTime(1499);
    expect(glow.style.opacity).toBe('0.5');
    vi.advanceTimersByTime(1);
    expect(Number(glow.style.opacity)).toBeCloseTo(0.225);
    harness.emit('move', 11, 61);
    expect(glow.style.opacity).toBe('0.5');
  });

  it('grows the glow and colors the arrow while the button is down', () => {
    plugin = cursorPlugin({ mode: 'replace' });
    plugin.setup(harness.context);
    plugin.configure?.(config, fullMotion);
    const root = cursorRoot();
    const path = root.querySelector('path');
    harness.emit('down', 10, 60);
    expect(glowOf(root).style.transform).toBe('scale(1.5)');
    expect(Number(glowOf(root).style.opacity)).toBeCloseTo(0.85);
    expect(path?.getAttribute('fill')).toBe('#ff0000');
    harness.emit('up', 10, 60);
    expect(glowOf(root).style.transform).toBe('none');
    expect(path?.getAttribute('fill')).toBe('#ffffff');
  });

  it('keeps the glow static with reduced motion', () => {
    plugin = cursorPlugin({ mode: 'replace' });
    plugin.setup(harness.context);
    plugin.configure?.(config, { ...fullMotion, motion: 'reduced' });
    const root = cursorRoot();
    harness.emit('down', 10, 60);
    expect(glowOf(root).style.transform).toBe('none');
    expect(glowOf(root).style.opacity).toBe('0.5');
    expect(glowOf(root).style.transition).toBe('none');
    vi.advanceTimersByTime(2000);
    expect(glowOf(root).style.opacity).toBe('0.5');
  });

  it('hides for touch input, on window blur and when the pointer leaves', () => {
    plugin = cursorPlugin();
    plugin.setup(harness.context);
    const root = cursorRoot();
    harness.emit('move', 10, 60);
    expect(root.style.opacity).toBe('1');
    harness.emit('move', 10, 60, 'touch');
    expect(root.style.opacity).toBe('0');

    harness.emit('move', 10, 60);
    window.dispatchEvent(new Event('blur'));
    expect(root.style.opacity).toBe('0');

    harness.emit('move', 10, 60);
    document.documentElement.dispatchEvent(new MouseEvent('mouseleave'));
    expect(root.style.opacity).toBe('0');

    harness.emit('move', 10, 60);
    harness.emit('leave', 10, 60);
    expect(root.style.opacity).toBe('0');
  });

  it('hides the native cursor in replace mode and restores it over interactive and ignored elements', () => {
    const button = document.createElement('button');
    const ignored = document.createElement('div');
    ignored.className = 'no-wand';
    const plain = document.createElement('p');
    document.body.append(button, ignored, plain);
    document.documentElement.style.cursor = 'crosshair';

    plugin = cursorPlugin({ mode: 'replace', ignoreSelector: '.no-wand' });
    plugin.setup(harness.context);
    const root = cursorRoot();
    expect(root.querySelector('svg path')?.getAttribute('d')).toContain('M3 2');
    expect(document.documentElement.style.cursor).toBe('none');

    harness.emit('move', 10, 60);
    hoverOver(button);
    expect(document.documentElement.style.cursor).toBe('crosshair');
    expect(root.style.opacity).toBe('0');

    hoverOver(plain);
    expect(document.documentElement.style.cursor).toBe('none');
    expect(root.style.opacity).toBe('1');

    hoverOver(ignored);
    expect(document.documentElement.style.cursor).toBe('crosshair');

    plugin.destroy?.();
    expect(document.documentElement.style.cursor).toBe('crosshair');
  });

  it('sets the cursor style on the target element in container mode', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    harness = createHarness('container', target);
    plugin = cursorPlugin({ mode: 'replace' });
    plugin.setup(harness.context);
    expect(target.style.cursor).toBe('none');
    expect(document.documentElement.style.cursor).toBe('');
    plugin.destroy?.();
    expect(target.style.cursor).toBe('');
  });

  it('uses the render function in place of the arrow and calls its cleanup', () => {
    const cleanup = vi.fn();
    plugin = cursorPlugin({
      mode: 'replace',
      render(element) {
        const dot = document.createElement('i');
        dot.className = 'dot';
        element.appendChild(dot);
        return cleanup;
      },
    });
    plugin.setup(harness.context);
    const root = cursorRoot();
    expect(root.querySelector('svg')).toBeNull();
    expect(root.querySelector('.dot')).not.toBeNull();
    plugin.destroy?.();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('hides when the section is disabled', () => {
    plugin = cursorPlugin({ mode: 'replace' });
    plugin.setup(harness.context);
    harness.emit('move', 10, 60);
    harness.wand.setConfig({ cursor: { enabled: false } });
    expect(cursorRoot().style.opacity).toBe('0');
    expect(document.documentElement.style.cursor).toBe('');
    harness.wand.setConfig({ cursor: { enabled: true } });
    expect(cursorRoot().style.opacity).toBe('1');
  });

  it('removes all DOM and listeners on destroy', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    plugin = cursorPlugin({ mode: 'replace' });
    plugin.setup(harness.context);
    harness.emit('move', 10, 60);
    plugin.destroy?.();
    expect(document.querySelector('[data-wand-cursor]')).toBeNull();
    expect(harness.pointerHandlers.size).toBe(0);
    expect(harness.wand.listenerCount).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    const removed = removeSpy.mock.calls.map(([type]) => type);
    expect(removed).toEqual(expect.arrayContaining(['pointerover', 'blur']));
    removeSpy.mockRestore();
  });
});
