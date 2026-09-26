import { afterEach, describe, expect, it } from 'vitest';
import type { WandError } from '../config/types';
import type { AnyConfig } from './engine';
import { drawOnPress, drawWithModifier, neverDraw } from './input';
import { createManualScheduler } from './scheduler';
import { createTestWand, fakeEffect } from './test-support';
import type { DrawPredicate, Wand } from './types';

const cleanup: (() => void)[] = [];

afterEach(() => {
  for (const undo of cleanup.splice(0)) undo();
});

function attach<T extends HTMLElement>(element: T): T {
  document.body.appendChild(element);
  cleanup.push(() => element.remove());
  return element;
}

function wandOf(wand: Wand<AnyConfig>): Wand<AnyConfig> {
  cleanup.push(() => wand.destroy());
  return wand;
}

function fire(target: EventTarget, type: string, init: PointerEventInit = {}): void {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      button: 0,
      ...init,
    }),
  );
}

function evaluate(predicate: DrawPredicate, target: Element, init: PointerEventInit = {}): boolean {
  let result: boolean | undefined;
  const listener = (event: Event): void => {
    result = predicate(event as PointerEvent);
  };
  target.addEventListener('pointerdown', listener);
  fire(target, 'pointerdown', init);
  target.removeEventListener('pointerdown', listener);
  return result ?? false;
}

describe('draw presets', () => {
  it('drawOnPress accepts the primary button on plain content', () => {
    const plain = attach(document.createElement('div'));
    expect(evaluate(drawOnPress, plain)).toBe(true);
    expect(evaluate(drawOnPress, plain, { button: 2 })).toBe(false);
  });

  it('drawOnPress refuses interactive elements and their children', () => {
    const button = attach(document.createElement('button'));
    const inner = button.appendChild(document.createElement('span'));
    const editable = attach(document.createElement('div'));
    editable.setAttribute('contenteditable', '');
    expect(evaluate(drawOnPress, button)).toBe(false);
    expect(evaluate(drawOnPress, inner)).toBe(false);
    expect(evaluate(drawOnPress, editable)).toBe(false);
  });

  it('drawWithModifier needs the modifier key', () => {
    const plain = attach(document.createElement('div'));
    const predicate = drawWithModifier('Alt');
    expect(evaluate(predicate, plain)).toBe(false);
    expect(evaluate(predicate, plain, { altKey: true })).toBe(true);
  });

  it('neverDraw refuses each press', () => {
    const plain = attach(document.createElement('div'));
    expect(evaluate(neverDraw, plain)).toBe(false);
  });
});

describe('pointer input', () => {
  it('starts a stroke, locks the selection and restores it at the end', () => {
    document.documentElement.style.userSelect = 'text';
    cleanup.push(() => {
      document.documentElement.style.userSelect = '';
    });
    const plain = attach(document.createElement('div'));
    const effect = fakeEffect('fx');
    wandOf(createTestWand({ effects: [effect], scheduler: createManualScheduler() }));
    fire(plain, 'pointerdown', { clientX: 5, clientY: 6 });
    expect(effect.pointers[0]).toMatchObject({
      phase: 'down',
      drawing: true,
      pointerType: 'mouse',
    });
    expect(document.documentElement.style.userSelect).toBe('none');
    fire(plain, 'pointermove', { clientX: 8, clientY: 9 });
    expect(effect.pointers[1]).toMatchObject({ phase: 'move', drawing: true });
    expect(effect.pointers[1]?.samples.length).toBeGreaterThan(0);
    fire(plain, 'pointerup');
    expect(effect.pointers[2]).toMatchObject({ phase: 'up' });
    expect(document.documentElement.style.userSelect).toBe('text');
  });

  it('does not start a stroke over the ignore selector', () => {
    const ignored = attach(document.createElement('div'));
    ignored.className = 'no-wand';
    const effect = fakeEffect('fx');
    wandOf(
      createTestWand({
        effects: [effect],
        scheduler: createManualScheduler(),
        ignoreSelector: '.no-wand',
      }),
    );
    fire(ignored, 'pointerdown');
    expect(effect.pointers[0]).toMatchObject({ phase: 'down', drawing: false });
  });

  it('uses the shouldDraw option', () => {
    const plain = attach(document.createElement('div'));
    const effect = fakeEffect('fx');
    wandOf(
      createTestWand({
        effects: [effect],
        scheduler: createManualScheduler(),
        shouldDraw: neverDraw,
      }),
    );
    fire(plain, 'pointerdown');
    expect(effect.pointers[0]?.drawing).toBe(false);
  });

  it('gives a tap for overlay touch input and does not block the scroll', () => {
    const plain = attach(document.createElement('div'));
    const effect = fakeEffect('fx');
    wandOf(createTestWand({ effects: [effect], scheduler: createManualScheduler() }));
    const down = new PointerEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      pointerId: 7,
      pointerType: 'touch',
      isPrimary: true,
      button: 0,
      clientX: 20,
      clientY: 30,
    });
    plain.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(false);
    expect(effect.pointers).toHaveLength(0);
    fire(plain, 'pointerup', { pointerId: 7, pointerType: 'touch', clientX: 21, clientY: 30 });
    expect(effect.pointers).toHaveLength(1);
    expect(effect.pointers[0]).toMatchObject({ phase: 'tap', drawing: true, pointerType: 'touch' });
  });

  it('ends a touch without an error on pointercancel', () => {
    const plain = attach(document.createElement('div'));
    const effect = fakeEffect('fx');
    const wand = wandOf(createTestWand({ effects: [effect], scheduler: createManualScheduler() }));
    const errors: WandError[] = [];
    wand.on('error', (error) => errors.push(error));
    fire(plain, 'pointerdown', { pointerId: 3, pointerType: 'touch' });
    fire(plain, 'pointercancel', { pointerId: 3, pointerType: 'touch' });
    fire(plain, 'pointerup', { pointerId: 3, pointerType: 'touch' });
    expect(effect.pointers).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });

  it('ends a mouse stroke silently on pointercancel', () => {
    const plain = attach(document.createElement('div'));
    const effect = fakeEffect('fx');
    wandOf(createTestWand({ effects: [effect], scheduler: createManualScheduler() }));
    fire(plain, 'pointerdown');
    fire(plain, 'pointercancel');
    expect(effect.pointers.map((event) => event.phase)).toEqual(['down', 'cancel']);
    expect(document.documentElement.style.userSelect).toBe('');
  });

  it('draws with touch in container mode', () => {
    const target = attach(document.createElement('div'));
    target.style.width = '200px';
    target.style.height = '200px';
    const effect = fakeEffect('fx');
    wandOf(createTestWand({ effects: [effect], target, scheduler: createManualScheduler() }));
    fire(target, 'pointerdown', { pointerId: 4, pointerType: 'touch' });
    expect(effect.pointers[0]).toMatchObject({ phase: 'down', drawing: true });
  });

  it('gives the pointer events to plugins', () => {
    const plain = attach(document.createElement('div'));
    const phases: string[] = [];
    wandOf(
      createTestWand({
        effects: [],
        plugins: [
          {
            name: 'probe',
            schema: {},
            setup(context) {
              context.onPointer((event) => phases.push(event.phase));
            },
          },
        ],
        scheduler: createManualScheduler(),
      }),
    );
    fire(plain, 'pointerdown');
    fire(plain, 'pointerup');
    expect(phases).toEqual(['down', 'up']);
  });
});
