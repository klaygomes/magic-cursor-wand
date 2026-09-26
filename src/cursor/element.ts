const SVG_NS = 'http://www.w3.org/2000/svg';
const ARROW_PATH = 'M3 2 L3 20.5 L7.9 16 L11.4 23.6 L14.9 22.1 L11.4 14.6 L18.2 14.6 Z';
const ARROW_INK = '#ffffff';
const ARROW_OUTLINE = '#0e1512';
const HIDDEN_OFFSET = -100;

/** Use this function to render custom content in place of the arrow. It can return a cleanup function. */
// biome-ignore lint/suspicious/noConfusingVoidType: a render callback without a return value is valid.
export type CursorRender = (element: HTMLElement) => void | (() => void);

/** The configured look of the cursor. */
export interface CursorLook {
  readonly glowSize: number;
  readonly glowStrength: number;
  readonly glowPress: number;
  readonly color: string;
}

/** The visual state of the cursor. */
export interface CursorVisualState {
  readonly visible: boolean;
  readonly idle: boolean;
  readonly pressed: boolean;
  readonly reducedMotion: boolean;
}

/** The DOM elements of the cursor. */
export interface CursorElements {
  readonly root: HTMLDivElement;
  readonly glow: HTMLSpanElement;
  readonly pointer: HTMLSpanElement | undefined;
  readonly ink: SVGPathElement | undefined;
  readonly cleanup: (() => void) | undefined;
}

function createArrow(doc: Document): { svg: SVGSVGElement; path: SVGPathElement } {
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', '26');
  svg.setAttribute('height', '26');
  svg.setAttribute('viewBox', '0 0 26 26');
  svg.style.display = 'block';
  svg.style.overflow = 'visible';
  svg.style.filter = 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.45))';
  const path = doc.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', ARROW_PATH);
  path.setAttribute('fill', ARROW_INK);
  path.setAttribute('stroke', ARROW_OUTLINE);
  path.setAttribute('stroke-width', '1.6');
  path.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(path);
  return { svg, path };
}

function createPointer(
  doc: Document,
  render: CursorRender | undefined,
): Pick<CursorElements, 'pointer' | 'ink' | 'cleanup'> {
  const pointer = doc.createElement('span');
  pointer.style.position = 'absolute';
  pointer.style.display = 'block';
  if (render) {
    pointer.style.left = '0';
    pointer.style.top = '0';
    pointer.style.transformOrigin = '0 0';
    const cleanup = render(pointer);
    return {
      pointer,
      ink: undefined,
      cleanup: typeof cleanup === 'function' ? cleanup : undefined,
    };
  }
  pointer.style.left = '-3px';
  pointer.style.top = '-2px';
  pointer.style.transformOrigin = '3px 2px';
  const { svg, path } = createArrow(doc);
  pointer.appendChild(svg);
  return { pointer, ink: path, cleanup: undefined };
}

/**
 * Create the cursor elements. The elements are not in the document.
 *
 * @param doc - The document that owns the elements.
 * @param showPointer - Set to true to show the arrow or the custom content.
 * @param render - The function that replaces the arrow.
 * @returns The cursor elements.
 */
export function createCursorElements(
  doc: Document,
  showPointer: boolean,
  render: CursorRender | undefined,
): CursorElements {
  const root = doc.createElement('div');
  root.setAttribute('aria-hidden', 'true');
  root.setAttribute('data-wand-cursor', '');
  const style = root.style;
  style.position = 'fixed';
  style.left = '0';
  style.top = '0';
  style.width = '0';
  style.height = '0';
  style.zIndex = '2147483647';
  style.pointerEvents = 'none';
  style.opacity = '0';
  style.willChange = 'transform';
  style.transform = `translate(${HIDDEN_OFFSET}px, ${HIDDEN_OFFSET}px)`;

  const glow = doc.createElement('span');
  glow.style.position = 'absolute';
  glow.style.display = 'block';
  glow.style.borderRadius = '50%';
  root.appendChild(glow);

  const parts = showPointer
    ? createPointer(doc, render)
    : { pointer: undefined, ink: undefined, cleanup: undefined };
  if (parts.pointer) root.appendChild(parts.pointer);
  return { root, glow, ...parts };
}

/**
 * Move the cursor to a position in client coordinates.
 *
 * @param elements - The cursor elements.
 * @param x - The horizontal client position.
 * @param y - The vertical client position.
 */
export function moveCursor(elements: CursorElements, x: number, y: number): void {
  elements.root.style.transform = `translate(${x}px, ${y}px)`;
}

function rgbOf(hex: string): string {
  const value = Number.parseInt(hex.slice(1), 16);
  if (!Number.isFinite(value)) return '255, 255, 255';
  return `${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}`;
}

function glowOpacity(look: CursorLook, state: CursorVisualState): number {
  if (state.reducedMotion) return look.glowStrength;
  if (state.pressed) return Math.min(1, look.glowStrength * 1.7);
  if (state.idle) return look.glowStrength * 0.45;
  return look.glowStrength;
}

/**
 * Write the look and the state of the cursor to the element styles.
 *
 * @param elements - The cursor elements.
 * @param look - The configured look.
 * @param state - The visual state.
 */
export function paintCursor(
  elements: CursorElements,
  look: CursorLook,
  state: CursorVisualState,
): void {
  const { root, glow, pointer, ink } = elements;
  const animate = !state.reducedMotion;
  const pressed = animate && state.pressed;

  root.style.transition = animate ? 'opacity 0.25s ease' : 'none';
  root.style.opacity = state.visible ? '1' : '0';

  const rgb = rgbOf(look.color);
  const half = look.glowSize / 2;
  glow.style.display = look.glowSize > 0 ? 'block' : 'none';
  glow.style.left = `${-half}px`;
  glow.style.top = `${-half}px`;
  glow.style.width = `${look.glowSize}px`;
  glow.style.height = `${look.glowSize}px`;
  glow.style.background = `radial-gradient(circle, rgba(${rgb}, 0.35) 0%, rgba(${rgb}, 0) 70%)`;
  glow.style.opacity = String(glowOpacity(look, state));
  glow.style.transform = pressed ? `scale(${look.glowPress})` : 'none';
  glow.style.transition = animate ? 'opacity 0.4s ease, transform 0.3s ease' : 'none';

  if (pointer) {
    pointer.style.transform = pressed ? 'scale(0.88)' : 'none';
    pointer.style.transition = animate ? 'transform 0.15s ease' : 'none';
  }
  if (ink) {
    ink.style.transition = animate ? 'fill 0.15s ease' : 'none';
    ink.setAttribute('fill', state.pressed ? look.color : ARROW_INK);
  }
}
