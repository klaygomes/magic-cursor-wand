import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createWand } from '../src';
import { cursorPlugin } from '../src/cursor';
import { panelPlugin } from '../src/panel';
import { httpProvider, localStorageProvider } from '../src/providers';

interface Registration {
  readonly target: EventTarget;
  readonly type: string;
  readonly listener: unknown;
}

const restore: (() => void)[] = [];
let listeners: Registration[] = [];
let frames = new Set<number>();
let timers = new Set<number>();
let observers = new Set<ResizeObserver>();

function instrument(): void {
  const proto = EventTarget.prototype;
  const add = proto.addEventListener;
  const remove = proto.removeEventListener;
  proto.addEventListener = function (this: EventTarget, type, listener, options) {
    if (!(this instanceof AbortSignal)) listeners.push({ target: this, type, listener });
    return add.call(this, type, listener, options);
  };
  proto.removeEventListener = function (this: EventTarget, type, listener, options) {
    listeners = listeners.filter(
      (entry) => !(entry.target === this && entry.type === type && entry.listener === listener),
    );
    return remove.call(this, type, listener, options);
  };

  const request = window.requestAnimationFrame;
  const cancel = window.cancelAnimationFrame;
  window.requestAnimationFrame = (callback) => {
    const handle = request.call(window, (now) => {
      frames.delete(handle);
      callback(now);
    });
    frames.add(handle);
    return handle;
  };
  window.cancelAnimationFrame = (handle) => {
    frames.delete(handle);
    cancel.call(window, handle);
  };

  const setTimer = window.setTimeout;
  const clearTimer = window.clearTimeout;
  window.setTimeout = ((callback: () => void, delay?: number) => {
    const handle = setTimer.call(
      window,
      () => {
        timers.delete(handle);
        callback();
      },
      delay,
    );
    timers.add(handle);
    return handle;
  }) as typeof window.setTimeout;
  window.clearTimeout = (handle?: number) => {
    if (handle !== undefined) timers.delete(handle);
    clearTimer.call(window, handle);
  };

  const Original = window.ResizeObserver;
  class Tracked extends Original {
    constructor(callback: ResizeObserverCallback) {
      super(callback);
      observers.add(this);
    }
    override disconnect(): void {
      observers.delete(this);
      super.disconnect();
    }
  }
  window.ResizeObserver = Tracked;

  restore.push(() => {
    proto.addEventListener = add;
    proto.removeEventListener = remove;
    window.requestAnimationFrame = request;
    window.cancelAnimationFrame = cancel;
    window.setTimeout = setTimer;
    window.clearTimeout = clearTimer;
    window.ResizeObserver = Original;
  });
}

function live(entry: Registration): boolean {
  return !(entry.target instanceof Node) || entry.target.isConnected;
}

function pointer(type: string, x: number, y: number): void {
  document.body.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      button: 0,
      clientX: x,
      clientY: y,
    }),
  );
}

beforeEach(() => {
  listeners = [];
  frames = new Set();
  timers = new Set();
  observers = new Set();
  instrument();
});

afterEach(() => {
  for (const undo of restore.splice(0)) undo();
  window.localStorage.removeItem('wand-leak');
});

describe('destroy with plugins and providers', () => {
  it('removes every listener, frame, timer and element', async () => {
    const fetch = async (): Promise<Response> => new Response('{"v":1}');
    const wand = createWand({
      silent: true,
      config: { theme: { motion: 'full' } },
      providers: [
        httpProvider({ url: '/wand.json', pollMs: 50, fetch }),
        localStorageProvider({ key: 'wand-leak' }),
      ],
      plugins: [
        cursorPlugin({ mode: 'replace' }),
        panelPlugin({ hotkey: 'Alt+W', launcher: true, load: () => new Promise(() => {}) }),
      ],
    });
    await wand.ready;
    pointer('pointerdown', 50, 50);
    pointer('pointermove', 80, 60);
    wand.setConfig({ chalk: { size: 20 } });

    expect(listeners.filter(live).length).toBeGreaterThan(0);
    expect(timers.size).toBeGreaterThan(0);
    expect(frames.size).toBeGreaterThan(0);

    wand.destroy();

    expect(listeners.filter(live)).toEqual([]);
    expect(frames.size).toBe(0);
    expect(timers.size).toBe(0);
    expect(observers.size).toBe(0);
    expect(document.querySelectorAll('canvas, [data-wand-cursor], [data-wand-ui]')).toHaveLength(0);
    expect(document.documentElement.style.cursor).toBe('');
    expect(document.documentElement.style.userSelect).toBe('');
  });
});
