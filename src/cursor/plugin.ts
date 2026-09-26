import { field } from '../config/field';
import type { ColorField, Motion, NumberField, ThemeConfig } from '../config/types';
import type { EffectConfig, Plugin, PluginContext, WandPointerEvent } from '../core/types';
import {
  type CursorElements,
  type CursorLook,
  type CursorRender,
  createCursorElements,
  moveCursor,
  paintCursor,
} from './element';

const INTERACTIVE_SELECTOR = 'a, button, input, textarea, select, label, [contenteditable]';
const UI_SELECTOR = '[data-wand-ui]';
const IDLE_DELAY_MS = 1500;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** The schema of the cursor section. */
export type CursorSchema = {
  readonly glowSize: NumberField;
  readonly glowStrength: NumberField;
  readonly glowPress: NumberField;
  readonly color: ColorField<true>;
};

/** The cursor plugin. */
export type CursorPlugin = Plugin<'cursor', CursorSchema>;

/** The display mode of the cursor plugin. */
export type CursorMode = 'glow' | 'replace';

/** The options of the cursor plugin. */
export interface CursorPluginOptions {
  /** Set `replace` to hide the native cursor and show an arrow. The default is `glow`. */
  readonly mode?: CursorMode;
  /** Use this function to render custom content in place of the arrow. */
  readonly render?: CursorRender;
  /** The native cursor comes back over elements that match this selector. */
  readonly ignoreSelector?: string;
}

const cursorSchema: CursorSchema = {
  glowSize: field.number({
    label: 'Glow size',
    description: 'The diameter of the glow in pixels. The value 0 removes the glow.',
    default: 80,
    min: 0,
    max: 240,
    step: 2,
  }),
  glowStrength: field.number({
    label: 'Glow strength',
    description: 'The opacity of the glow.',
    default: 0.55,
    min: 0,
    max: 1,
    step: 0.05,
  }),
  glowPress: field.number({
    label: 'Glow press',
    description: 'The scale of the glow while the pointer button is down.',
    default: 1.25,
    min: 1,
    max: 2.5,
    step: 0.05,
  }),
  color: field.color({
    label: 'Color',
    description: 'The color of the glow. The value null uses the theme color.',
    default: null,
    nullable: true,
  }),
};

interface CursorController {
  configure(look: CursorLook, motion: Motion): void;
  destroy(): void;
}

function sectionEnabled(config: unknown): boolean {
  if (typeof config !== 'object' || config === null) return true;
  const section = (config as { cursor?: unknown }).cursor;
  if (typeof section !== 'object' || section === null) return true;
  return (section as { enabled?: unknown }).enabled !== false;
}

function hideTargetSelector(mode: CursorMode, ignoreSelector: string | undefined): string {
  const selectors = [UI_SELECTOR];
  if (mode === 'replace') selectors.push(INTERACTIVE_SELECTOR);
  if (ignoreSelector) selectors.push(ignoreSelector);
  return selectors.join(', ');
}

function mountCursor(
  context: PluginContext,
  options: CursorPluginOptions,
  initialLook: CursorLook,
  initialMotion: Motion,
): CursorController {
  const mode = options.mode ?? 'glow';
  const doc = context.surface.element.ownerDocument;
  const view = doc.defaultView ?? window;
  const host = context.surface.mode === 'overlay' ? doc.documentElement : context.surface.element;
  const previousHostCursor = host.style.cursor;
  const hideSelector = hideTargetSelector(mode, options.ignoreSelector);
  const elements: CursorElements = createCursorElements(
    doc,
    mode === 'replace' || options.render !== undefined,
    options.render,
  );
  const media =
    typeof view.matchMedia === 'function' ? view.matchMedia(REDUCED_MOTION_QUERY) : null;

  let look = initialLook;
  let motion = initialMotion;
  let enabled = sectionEnabled(context.wand.getConfig());
  let awake = false;
  let idle = false;
  let pressed = false;
  let overHideTarget = false;
  let idleTimer = 0;

  const reducedMotion = (): boolean => {
    if (motion === 'reduced' || motion === 'off') return true;
    if (motion === 'full') return false;
    return media?.matches ?? false;
  };

  const paint = (): void => {
    paintCursor(elements, look, {
      visible: enabled && awake && !overHideTarget,
      idle,
      pressed,
      reducedMotion: reducedMotion(),
    });
    const hideNative = mode === 'replace' && enabled && !overHideTarget;
    host.style.cursor = hideNative ? 'none' : previousHostCursor;
  };

  const clearIdleTimer = (): void => {
    if (idleTimer) view.clearTimeout(idleTimer);
    idleTimer = 0;
  };

  const restartIdleTimer = (): void => {
    clearIdleTimer();
    idleTimer = view.setTimeout(() => {
      idleTimer = 0;
      idle = true;
      paint();
    }, IDLE_DELAY_MS);
  };

  const sleep = (): void => {
    awake = false;
    pressed = false;
    clearIdleTimer();
    paint();
  };

  const onPointer = (event: WandPointerEvent): void => {
    if (event.pointerType === 'touch' || event.phase === 'tap') {
      sleep();
      return;
    }
    if (event.phase === 'leave') {
      sleep();
      return;
    }
    const client = context.surface.toClient(event);
    moveCursor(elements, client.x, client.y);
    if (event.phase === 'down') pressed = true;
    if (event.phase === 'up' || event.phase === 'cancel') pressed = false;
    awake = true;
    idle = false;
    restartIdleTimer();
    paint();
  };

  const onPointerOver = (event: PointerEvent): void => {
    if (event.pointerType === 'touch') return;
    const target = event.target;
    const next =
      typeof (target as Element | null)?.closest === 'function' &&
      (target as Element).closest(hideSelector) !== null;
    if (next === overHideTarget) return;
    overHideTarget = next;
    paint();
  };

  const onMotionChange = (): void => paint();

  const unsubscribePointer = context.onPointer(onPointer);
  const unsubscribeConfig = context.wand.on('config', ({ next }) => {
    const nextEnabled = sectionEnabled(next);
    if (nextEnabled === enabled) return;
    enabled = nextEnabled;
    paint();
  });
  view.addEventListener('pointerover', onPointerOver, { capture: true, passive: true });
  view.addEventListener('blur', sleep);
  doc.documentElement.addEventListener('mouseleave', sleep);
  media?.addEventListener?.('change', onMotionChange);
  doc.body.appendChild(elements.root);
  paint();

  return {
    configure(nextLook, nextMotion) {
      look = nextLook;
      motion = nextMotion;
      paint();
    },
    destroy() {
      clearIdleTimer();
      unsubscribePointer();
      unsubscribeConfig();
      view.removeEventListener('pointerover', onPointerOver, { capture: true });
      view.removeEventListener('blur', sleep);
      doc.documentElement.removeEventListener('mouseleave', sleep);
      media?.removeEventListener?.('change', onMotionChange);
      elements.cleanup?.();
      elements.root.remove();
      host.style.cursor = previousHostCursor;
    },
  };
}

/**
 * Create a plugin that shows a glow at the pointer, or replaces the native cursor with an arrow.
 *
 * @param options - The display mode, the custom renderer and the selector of ignored elements.
 * @returns The plugin with the name `cursor`.
 * @example
 * createWand({ plugins: [cursorPlugin({ mode: 'replace', ignoreSelector: '.no-wand' })] });
 */
export function cursorPlugin(options: CursorPluginOptions = {}): CursorPlugin {
  let look: CursorLook = {
    glowSize: cursorSchema.glowSize.default,
    glowStrength: cursorSchema.glowStrength.default,
    glowPress: cursorSchema.glowPress.default,
    color: '#ffffff',
  };
  let motion: Motion = 'auto';
  let controller: CursorController | undefined;

  return {
    name: 'cursor',
    schema: cursorSchema,
    setup(context: PluginContext) {
      controller?.destroy();
      controller = mountCursor(context, options, look, motion);
    },
    configure(config: EffectConfig<CursorSchema>, theme: ThemeConfig) {
      look = {
        glowSize: config.glowSize,
        glowStrength: config.glowStrength,
        glowPress: config.glowPress,
        color: config.color,
      };
      motion = theme.motion;
      controller?.configure(look, motion);
    },
    destroy() {
      controller?.destroy();
      controller = undefined;
    },
  };
}
