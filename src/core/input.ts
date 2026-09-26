import type { Surface } from './surface';
import type { DrawPredicate, Point, WandPointerEvent, WandPointerPhase } from './types';

/** The elements where a press does not start a stroke. */
export const INTERACTIVE_SELECTOR = 'a, button, input, textarea, select, label, [contenteditable]';

const TAP_SLOP = 10;

function closest(target: EventTarget | null, selector: string): boolean {
  if (!(target instanceof Element)) return false;
  try {
    return target.closest(selector) !== null;
  } catch {
    return false;
  }
}

function isPrimary(event: PointerEvent): boolean {
  return event.button === 0 && event.isPrimary !== false;
}

/**
 * Starts a stroke on a press of the primary button, but not on an interactive element.
 *
 * @param event - The `pointerdown` event.
 * @returns `true` if the press starts a stroke.
 */
export const drawOnPress: DrawPredicate = (event) =>
  isPrimary(event) && !closest(event.target, INTERACTIVE_SELECTOR);

/**
 * Creates a predicate that starts a stroke only while the user holds a modifier key.
 *
 * @param key - The modifier key, for example `Alt` or `Shift`.
 * @returns The predicate.
 * @example
 * createWand({ shouldDraw: drawWithModifier('Alt') });
 */
export function drawWithModifier(key: 'Alt' | 'Control' | 'Meta' | 'Shift'): DrawPredicate {
  return (event) => isPrimary(event) && event.getModifierState(key);
}

/**
 * Never starts a stroke. The effects that follow the pointer continue to operate.
 *
 * @returns `false`.
 */
export const neverDraw: DrawPredicate = () => false;

/** The options of the pointer input. */
export interface InputOptions {
  readonly surface: Surface;
  readonly shouldDraw: DrawPredicate;
  readonly ignoreSelector?: string | undefined;
  /** Tells if a press can start a stroke. The input sends the pointer events also when it returns false. */
  readonly canDraw: () => boolean;
  readonly emit: (event: WandPointerEvent) => void;
  readonly onError: (error: unknown) => void;
}

/** The pointer input of one wand. */
export interface Input {
  /** Tells if a pointer is over the surface or a stroke continues. */
  readonly active: boolean;
  destroy(): void;
}

interface TapCandidate {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly clientX: number;
  readonly clientY: number;
  readonly drawing: boolean;
}

/**
 * Attaches the pointer listeners and converts the events to `WandPointerEvent` objects.
 *
 * @param options - The surface, the draw predicate and the event sink.
 * @returns The input.
 */
export function createInput(options: InputOptions): Input {
  const { surface } = options;
  const target = surface.listenerTarget;
  const overlay = surface.mode === 'overlay';
  const root = typeof document === 'undefined' ? undefined : document.documentElement;

  let activeId: number | undefined;
  let drawing = false;
  let hover = false;
  let tap: TapCandidate | undefined;
  let savedUserSelect: { standard: string; webkit: string } | undefined;

  const rootStyle = (): (CSSStyleDeclaration & { webkitUserSelect?: string }) | undefined =>
    root?.style;

  const lockSelection = (): void => {
    const style = rootStyle();
    if (!style || savedUserSelect) return;
    savedUserSelect = { standard: style.userSelect, webkit: style.webkitUserSelect ?? '' };
    style.userSelect = 'none';
    style.webkitUserSelect = 'none';
  };

  const unlockSelection = (): void => {
    const style = rootStyle();
    if (!style || !savedUserSelect) return;
    style.userSelect = savedUserSelect.standard;
    style.webkitUserSelect = savedUserSelect.webkit;
    savedUserSelect = undefined;
  };

  const shouldDraw = (event: PointerEvent): boolean => {
    if (options.ignoreSelector && closest(event.target, options.ignoreSelector)) return false;
    try {
      return options.shouldDraw(event);
    } catch (error) {
      options.onError(error);
      return false;
    }
  };

  const samplesOf = (event: PointerEvent): Point[] => {
    const coalesced =
      typeof event.getCoalescedEvents === 'function' ? event.getCoalescedEvents() : [];
    const source = coalesced.length > 0 ? coalesced : [event];
    return source.map((sample) => surface.toDocument(sample.clientX, sample.clientY));
  };

  const send = (phase: WandPointerPhase, point: Point, pointerType: string, samples: Point[]) => {
    options.emit({ phase, x: point.x, y: point.y, pointerType, drawing, samples });
  };

  const endStroke = (): void => {
    if (drawing && activeId !== undefined && surface.mode === 'container') {
      try {
        (target as Element).releasePointerCapture(activeId);
      } catch {}
    }
    activeId = undefined;
    drawing = false;
    unlockSelection();
  };

  const onDown = (event: PointerEvent): void => {
    if (activeId !== undefined) return;
    const point = surface.toDocument(event.clientX, event.clientY);
    const startsStroke = options.canDraw() && shouldDraw(event);
    if (overlay && event.pointerType === 'touch') {
      tap = {
        id: event.pointerId,
        x: point.x,
        y: point.y,
        clientX: event.clientX,
        clientY: event.clientY,
        drawing: startsStroke,
      };
      return;
    }
    activeId = event.pointerId;
    hover = true;
    drawing = startsStroke;
    if (drawing) {
      lockSelection();
      if (surface.mode === 'container') {
        try {
          (target as Element).setPointerCapture(event.pointerId);
        } catch {}
      }
    }
    send('down', point, event.pointerType, [point]);
  };

  const onMove = (event: PointerEvent): void => {
    if (overlay && event.pointerType === 'touch') return;
    if (activeId !== undefined && event.pointerId !== activeId) return;
    hover = true;
    const samples = samplesOf(event);
    const point = samples[samples.length - 1] ?? surface.toDocument(event.clientX, event.clientY);
    send('move', point, event.pointerType, samples);
  };

  const onUp = (event: PointerEvent): void => {
    if (tap && tap.id === event.pointerId) {
      const candidate = tap;
      tap = undefined;
      const moved = Math.hypot(
        event.clientX - candidate.clientX,
        event.clientY - candidate.clientY,
      );
      if (moved > TAP_SLOP) return;
      drawing = candidate.drawing && options.canDraw();
      const point = { x: candidate.x, y: candidate.y };
      send('tap', point, event.pointerType, [point]);
      drawing = false;
      return;
    }
    if (event.pointerId !== activeId) return;
    const point = surface.toDocument(event.clientX, event.clientY);
    send('up', point, event.pointerType, [point]);
    endStroke();
    if (event.pointerType !== 'mouse') hover = false;
  };

  const onCancel = (event: PointerEvent): void => {
    if (tap && tap.id === event.pointerId) {
      tap = undefined;
      return;
    }
    if (event.pointerId !== activeId) return;
    const point = surface.toDocument(event.clientX, event.clientY);
    endStroke();
    hover = false;
    send('cancel', point, event.pointerType, [point]);
  };

  const onLeave = (event: PointerEvent): void => {
    if (overlay && event.relatedTarget !== null) return;
    if (activeId !== undefined && surface.mode === 'container' && drawing) return;
    const point = surface.toDocument(event.clientX, event.clientY);
    endStroke();
    hover = false;
    send('leave', point, event.pointerType, [point]);
  };

  const listeners: [string, (event: PointerEvent) => void][] = [
    ['pointerdown', onDown],
    ['pointermove', onMove],
    ['pointerup', onUp],
    ['pointercancel', onCancel],
    [overlay ? 'pointerout' : 'pointerleave', onLeave],
  ];
  for (const [type, listener] of listeners) {
    target.addEventListener(type, listener as EventListener, { passive: true });
  }

  return {
    get active() {
      return hover || activeId !== undefined;
    },
    destroy() {
      for (const [type, listener] of listeners) {
        target.removeEventListener(type, listener as EventListener);
      }
      endStroke();
      tap = undefined;
      hover = false;
    },
  };
}
