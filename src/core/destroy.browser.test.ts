import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestWand, fakeEffect } from './test-support';

interface Registration {
  readonly target: EventTarget;
  readonly type: string;
  readonly listener: unknown;
}

const restore: (() => void)[] = [];
let listeners: Registration[] = [];
let frames = new Set<number>();
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
    window.ResizeObserver = Original;
  });
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

beforeEach(() => {
  listeners = [];
  frames = new Set();
  observers = new Set();
  instrument();
});

afterEach(() => {
  for (const undo of restore.splice(0)) undo();
});

describe('destroy', () => {
  it('removes every listener, frame and observer', async () => {
    const target = document.createElement('div');
    target.style.width = '100px';
    target.style.height = '100px';
    document.body.appendChild(target);

    const overlay = createTestWand({ effects: [fakeEffect('a')] });
    const container = createTestWand({ effects: [fakeEffect('b')], target });
    target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
    await nextFrame();
    await nextFrame();

    expect(listeners.length).toBeGreaterThan(0);
    expect(frames.size).toBeGreaterThan(0);
    expect(observers.size).toBe(1);

    overlay.destroy();
    container.destroy();
    container.destroy();

    expect(listeners).toEqual([]);
    expect(frames.size).toBe(0);
    expect(observers.size).toBe(0);
    expect(document.documentElement.style.userSelect).toBe('');
    expect(document.querySelectorAll('canvas')).toHaveLength(0);
    target.remove();
  });

  it('calls destroy on each effect and ignores calls after destroy', () => {
    const effect = fakeEffect('fx');
    const wand = createTestWand({ effects: [effect] });
    wand.destroy();
    wand.destroy();
    wand.setConfig({ fx: { size: 1 } });
    wand.start();
    expect(effect.destroyed).toBe(1);
    expect(frames.size).toBe(0);
  });
});
