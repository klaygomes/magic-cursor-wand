import type {
  ConfigStore,
  ConfigStoreOptions,
  Schema,
  Section,
  ThemeConfig,
  WandError,
} from '../config/types';
import { createEmitter, createEventBus } from './bus';
import { createWarnOnce, effectError } from './errors';
import { createInput, drawOnPress, type Input } from './input';
import { acquireEnvironment, getDefaultScheduler, joinFrameLoop } from './scheduler';
import { createSurface, type Surface } from './surface';
import { themeSection } from './theme';
import type {
  Effect,
  EffectContext,
  Frame,
  Plugin,
  PluginContext,
  Wand,
  WandLifecycleEvents,
  WandOptions,
  WandPointerEvent,
} from './types';

type SectionValues = Record<string, unknown>;

/** The untyped configuration that the engine uses internally. */
export type AnyConfig = Record<string, SectionValues>;

/** Creates the configuration store of a wand. */
export type StoreFactory = (options: ConfigStoreOptions<AnyConfig>) => ConfigStore<AnyConfig>;

/** The options of `createWandWith`. */
export type EngineOptions = WandOptions & {
  readonly effects?: readonly Effect[];
  readonly plugins?: readonly Plugin[];
};

const FRAME_MS = 1000 / 60;
const MAX_DT = 3;
const MAX_FAILURES = 3;

interface Participant {
  readonly section: Section;
  enabled: boolean;
  resolved: SectionValues | undefined;
}

interface EffectState extends Participant {
  readonly section: Effect;
  failures: number;
  broken: boolean;
}

interface PluginState extends Participant {
  readonly section: Plugin;
}

type MutableFrame = { -readonly [K in keyof Frame]: Frame[K] };

/**
 * Resolves the values of one section. A `null` color gets the theme color and a missing value gets the default.
 *
 * @param schema - The schema of the section.
 * @param values - The merged values of the section.
 * @param themeColor - The color of the theme.
 * @returns The values that the section receives.
 */
export function resolveSection(
  schema: Schema,
  values: SectionValues | undefined,
  themeColor: string,
): SectionValues {
  const resolved: SectionValues = {};
  for (const key of Object.keys(schema)) {
    const definition = schema[key];
    const value = values?.[key] === undefined ? definition?.default : values[key];
    resolved[key] = value === null && definition?.kind === 'color' ? themeColor : value;
  }
  return resolved;
}

function sameValues(a: SectionValues | undefined, b: SectionValues): boolean {
  if (!a) return false;
  for (const key of Object.keys(b)) {
    if (!Object.is(a[key], b[key])) return false;
  }
  return true;
}

function noop(): void {}

/**
 * Creates a wand with a given configuration store. `createWand` uses it, and tests use it to give a fake store.
 *
 * @param createStore - The factory of the configuration store.
 * @param options - The options of the wand.
 * @param defaultEffects - Creates the effects when the options do not contain `effects`.
 * @returns The wand.
 * @throws If a different overlay wand exists.
 */
export function createWandWith(
  createStore: StoreFactory,
  options: EngineOptions,
  defaultEffects: () => readonly Effect[],
): Wand<AnyConfig> {
  const scheduler = options.scheduler ?? getDefaultScheduler();
  const random = options.random ?? Math.random;
  const lifecycle = createEmitter<WandLifecycleEvents<AnyConfig>>();
  const report = (error: WandError): void => lifecycle.emit('error', error);
  if (!options.silent) lifecycle.on('error', createWarnOnce());

  const effects = [...(options.effects ?? defaultEffects())].sort((a, b) => a.layer - b.layer);
  const plugins = options.plugins ?? [];

  const store = createStore({
    sections: [themeSection(), ...effects, ...plugins],
    ...(options.config ? { defaults: options.config as AnyConfig } : {}),
    ...(options.providers ? { providers: options.providers } : {}),
    ...(options.locked ? { locked: options.locked } : {}),
    ...(options.autosaveDebounceMs === undefined
      ? {}
      : { autosaveDebounceMs: options.autosaveDebounceMs }),
    onError: report,
  });

  let theme = store.get().theme as unknown as ThemeConfig;
  let surface: Surface;
  try {
    surface = createSurface({
      target: options.target,
      zIndex: options.zIndex,
      touchAction: options.touchAction,
      maxDpr: () => theme.maxDpr,
      onResize: () => wake(),
      onScroll: () => wake(),
    });
  } catch (error) {
    store.destroy();
    throw error;
  }
  const context = surface.context;

  let destroyed = false;
  let running = true;
  let readyGate = options.startAfter !== 'ready';
  const startAt =
    typeof options.startAfter === 'number' ? scheduler.now() + options.startAfter : -Infinity;
  let lastTime = scheduler.now();
  let idleCleared = true;
  let input: Input | undefined;

  const bus = createEventBus((error) => report(effectError('bus', error)));
  const pointerHandlers = new Set<(event: WandPointerEvent) => void>();

  const effectStates: EffectState[] = effects.map((section) => ({
    section,
    enabled: true,
    resolved: undefined,
    failures: 0,
    broken: false,
  }));
  const pluginStates: PluginState[] = plugins.map((section) => ({
    section,
    enabled: true,
    resolved: undefined,
  }));

  const environment = acquireEnvironment(() => wake());

  const reducedMotion = (): boolean =>
    theme.motion === 'reduced' ||
    (theme.motion === 'auto' && environment.environment.prefersReducedMotion);

  const frame: MutableFrame = {
    dt: 1,
    time: 0,
    reducedMotion: false,
    width: 0,
    height: 0,
    scrollX: 0,
    scrollY: 0,
  };

  const live = (): boolean => !destroyed && running && readyGate && theme.motion !== 'off';

  const fail = (state: EffectState, error: unknown): void => {
    state.failures++;
    if (state.failures < MAX_FAILURES) return;
    state.broken = true;
    try {
      state.section.clear();
    } catch {}
    report(effectError(state.section.name, error, true));
  };

  const drawable = (state: EffectState): boolean => state.enabled && !state.broken;

  const allIdle = (): boolean => {
    for (const state of effectStates) {
      if (!drawable(state)) continue;
      try {
        if (!state.section.isIdle()) return false;
      } catch (error) {
        fail(state, error);
        return false;
      }
    }
    return true;
  };

  const tick = (now: number): boolean => {
    if (!live()) return false;
    if (now < startAt) return true;
    frame.dt = Math.min(Math.max((now - lastTime) / FRAME_MS, 0), MAX_DT);
    frame.time = now;
    lastTime = now;
    frame.reducedMotion = reducedMotion();
    frame.width = surface.width;
    frame.height = surface.height;
    surface.measureScroll();
    frame.scrollX = surface.scrollX;
    frame.scrollY = surface.scrollY;

    if (!input?.active && allIdle()) {
      if (!idleCleared) surface.clear();
      idleCleared = true;
      return false;
    }
    idleCleared = false;
    surface.clear();
    if (!context) return true;

    const { dpr } = surface;
    for (const state of effectStates) {
      if (!drawable(state)) continue;
      const effect = state.section;
      try {
        effect.update(frame);
        context.globalAlpha = 1;
        context.globalCompositeOperation = effect.composite ?? 'source-over';
        context.setTransform(dpr, 0, 0, dpr, -frame.scrollX * dpr, -frame.scrollY * dpr);
        effect.draw(context, frame);
        state.failures = 0;
      } catch (error) {
        fail(state, error);
      }
    }
    return true;
  };

  const loop = joinFrameLoop(scheduler, { tick });

  function wake(): void {
    if (!live()) return;
    if (!loop.isAwake()) lastTime = scheduler.now();
    loop.wake();
  }

  const halt = (): void => {
    loop.sleep();
    surface.clear();
    idleCleared = true;
  };

  const applyConfig = (config: AnyConfig): void => {
    const previousTheme = theme;
    theme = config.theme as unknown as ThemeConfig;
    const themeChanged =
      previousTheme.color !== theme.color ||
      previousTheme.motion !== theme.motion ||
      previousTheme.maxDpr !== theme.maxDpr;
    const participants: (EffectState | PluginState)[] = [...effectStates, ...pluginStates];
    for (const state of participants) {
      const values = config[state.section.name];
      const enabled = values?.enabled !== false;
      const wasEnabled = state.enabled;
      state.enabled = enabled;
      if (wasEnabled && !enabled && 'failures' in state) {
        try {
          state.section.clear();
        } catch (error) {
          report(effectError(state.section.name, error));
        }
      }
      if (!enabled) continue;
      const resolved = resolveSection(state.section.schema, values, theme.color);
      if (!themeChanged && sameValues(state.resolved, resolved)) continue;
      state.resolved = resolved;
      try {
        state.section.configure?.(resolved as never, theme);
      } catch (error) {
        report(effectError(state.section.name, error));
      }
    }
    if (previousTheme.maxDpr !== theme.maxDpr) surface.resize();
    if (theme.motion === 'off') halt();
    else wake();
  };

  const emitPointer = (event: WandPointerEvent): void => {
    for (const state of effectStates) {
      if (!drawable(state) || !state.section.pointer) continue;
      try {
        state.section.pointer(event);
      } catch (error) {
        fail(state, error);
      }
    }
    for (const handler of pointerHandlers) {
      try {
        handler(event);
      } catch (error) {
        report(effectError('plugin', error));
      }
    }
    wake();
  };

  const guard = (source: string, action: () => void): void => {
    if (destroyed) return;
    try {
      action();
    } catch (error) {
      report(effectError(source, error));
    }
  };

  const ready = store.ready.then(noop, noop).then(() => {
    if (destroyed) return;
    if (!readyGate) {
      readyGate = true;
      wake();
    }
    lifecycle.emit('ready', undefined);
  });

  const unsubscribe = store.subscribe((next, previous) => {
    if (destroyed) return;
    applyConfig(next);
    lifecycle.emit('config', { next, previous });
  });

  const wand: Wand<AnyConfig> = {
    ready,
    sections: store.sections,
    getConfig: () => store.get(),
    setConfig: (patch) => guard('config', () => store.set(patch)),
    reset: () => guard('config', () => store.reset()),
    save: (saveOptions) =>
      destroyed
        ? Promise.resolve()
        : store.save(saveOptions).catch((cause: unknown) =>
            report({
              kind: 'provider',
              source: saveOptions?.to ?? 'save',
              message: 'The wand could not save the configuration.',
              cause,
            }),
          ),
    exportConfig: () => store.export(),
    importConfig: (document) => guard('config', () => store.import(document)),
    on: (type, handler) => (destroyed ? noop : lifecycle.on(type, handler)),
    start() {
      if (destroyed || running) return;
      running = true;
      wake();
    },
    stop() {
      if (destroyed || !running) return;
      running = false;
      halt();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      loop.release();
      environment.release();
      input?.destroy();
      unsubscribe();
      for (const state of effectStates) {
        try {
          state.section.destroy();
        } catch {}
      }
      for (const state of pluginStates) {
        try {
          state.section.destroy?.();
        } catch {}
      }
      pointerHandlers.clear();
      bus.clear();
      surface.destroy();
      store.destroy();
      lifecycle.clear();
    },
  };

  for (const state of effectStates) {
    const effectContext: EffectContext = {
      bus,
      random,
      createCanvas(width, height) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        return canvas;
      },
      reportError: (error) => report(effectError(state.section.name, error)),
    };
    try {
      state.section.setup(effectContext);
    } catch (error) {
      state.broken = true;
      report(effectError(state.section.name, error));
    }
  }

  for (const state of pluginStates) {
    const pluginContext: PluginContext = {
      wand: wand as unknown as Wand<unknown>,
      bus,
      surface,
      onPointer(handler) {
        const guarded = (event: WandPointerEvent): void => {
          if (state.enabled) handler(event);
        };
        pointerHandlers.add(guarded);
        return () => pointerHandlers.delete(guarded);
      },
    };
    try {
      state.section.setup(pluginContext);
    } catch (error) {
      report(effectError(state.section.name, error));
    }
  }

  applyConfig(store.get());

  input = createInput({
    surface,
    shouldDraw: options.shouldDraw ?? drawOnPress,
    ignoreSelector: options.ignoreSelector,
    accept: () => live() && scheduler.now() >= startAt,
    emit: emitPointer,
    onError: (error) => report(effectError('shouldDraw', error)),
  });

  wake();
  return wand;
}
