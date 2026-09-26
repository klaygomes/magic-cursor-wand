import type { Point, SurfaceInfo } from './types';

/** The default stack order of the canvas. */
export const DEFAULT_Z_INDEX = 2147483647;

/** The options of a drawing surface. */
export interface SurfaceOptions {
  readonly target?: HTMLElement | undefined;
  readonly zIndex?: number | undefined;
  readonly touchAction?: string | undefined;
  readonly maxDpr: () => number;
  readonly onResize: () => void;
  readonly onScroll: () => void;
}

/** A canvas that covers the viewport or a container, in document coordinates. */
export interface Surface extends SurfaceInfo {
  readonly context: CanvasRenderingContext2D | null;
  /** The element that receives the pointer listeners. */
  readonly listenerTarget: EventTarget;
  readonly width: number;
  readonly height: number;
  readonly dpr: number;
  readonly scrollX: number;
  readonly scrollY: number;
  /** Converts the client position of a pointer to document coordinates. */
  toDocument(clientX: number, clientY: number): Point;
  /** Reads the scroll offset. Call it one time for each frame. */
  measureScroll(): void;
  resize(): void;
  clear(): void;
  destroy(): void;
}

let overlayActive = false;

function styleCanvas(canvas: HTMLCanvasElement, position: string, zIndex: number): void {
  const style = canvas.style;
  style.position = position;
  style.left = '0px';
  style.top = '0px';
  style.pointerEvents = 'none';
  style.zIndex = String(zIndex);
  style.display = 'block';
  canvas.setAttribute('aria-hidden', 'true');
}

/**
 * Creates the canvas and attaches it to the page.
 *
 * @param options - The target element, the stack order and the callbacks for size and scroll changes.
 * @returns The surface.
 * @throws If a different overlay surface exists.
 */
export function createSurface(options: SurfaceOptions): Surface {
  const target = options.target;
  const mode: Surface['mode'] = target ? 'container' : 'overlay';
  if (mode === 'overlay' && overlayActive) {
    throw new Error(
      'Only one overlay wand can exist at a time. Destroy the current wand, or give a target element to the new wand.',
    );
  }

  const element = target ?? document.documentElement;
  const canvas = document.createElement('canvas');
  styleCanvas(canvas, target ? 'absolute' : 'fixed', options.zIndex ?? DEFAULT_Z_INDEX);
  const context = canvas.getContext('2d');
  const restore: (() => void)[] = [];

  const surface = {
    mode,
    element,
    canvas,
    context,
    listenerTarget: (target ?? window) as EventTarget,
    width: 0,
    height: 0,
    dpr: 1,
    scrollX: 0,
    scrollY: 0,
    toClient(point: Point): Point {
      if (!target) return { x: point.x - window.scrollX, y: point.y - window.scrollY };
      const rect = target.getBoundingClientRect();
      return {
        x: point.x - target.scrollLeft + rect.left + target.clientLeft,
        y: point.y - target.scrollTop + rect.top + target.clientTop,
      };
    },
    toDocument(clientX: number, clientY: number): Point {
      if (!target) return { x: clientX + window.scrollX, y: clientY + window.scrollY };
      const rect = target.getBoundingClientRect();
      return {
        x: clientX - rect.left - target.clientLeft + target.scrollLeft,
        y: clientY - rect.top - target.clientTop + target.scrollTop,
      };
    },
    measureScroll(): void {
      surface.scrollX = target ? target.scrollLeft : window.scrollX;
      surface.scrollY = target ? target.scrollTop : window.scrollY;
    },
    resize(): void {
      const width = target ? target.clientWidth : document.documentElement.clientWidth;
      const height = target ? target.clientHeight : document.documentElement.clientHeight;
      const dpr = Math.max(0.5, Math.min(window.devicePixelRatio || 1, options.maxDpr()));
      surface.width = width;
      surface.height = height;
      surface.dpr = dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    },
    clear(): void {
      if (!context) return;
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
    },
    destroy(): void {
      for (const undo of restore.splice(0).reverse()) undo();
      canvas.remove();
      if (!target) overlayActive = false;
    },
  };

  const onResize = (): void => {
    surface.resize();
    options.onResize();
  };

  if (target) {
    const previous = { position: target.style.position, touchAction: target.style.touchAction };
    if (getComputedStyle(target).position === 'static') target.style.position = 'relative';
    target.style.touchAction = options.touchAction ?? 'none';
    restore.push(() => {
      target.style.position = previous.position;
      target.style.touchAction = previous.touchAction;
    });

    const placeCanvas = (): void => {
      canvas.style.left = `${target.scrollLeft}px`;
      canvas.style.top = `${target.scrollTop}px`;
    };
    const onScroll = (): void => {
      placeCanvas();
      options.onScroll();
    };
    target.addEventListener('scroll', onScroll, { passive: true });
    restore.push(() => target.removeEventListener('scroll', onScroll));

    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(onResize);
      observer.observe(target);
      restore.push(() => observer.disconnect());
    }
    target.appendChild(canvas);
    placeCanvas();
  } else {
    overlayActive = true;
    const onScroll = (): void => options.onScroll();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, { passive: true });
    restore.push(() => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll);
    });
    (document.body ?? document.documentElement).appendChild(canvas);
  }

  surface.resize();
  surface.measureScroll();
  return surface;
}
