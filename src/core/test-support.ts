import { field } from '../config/field';
import type {
  ColorField,
  ConfigPatch,
  ConfigStore,
  ConfigStoreOptions,
  NumberField,
  Schema,
} from '../config/types';
import { type AnyConfig, createWandWith, type EngineOptions } from './engine';
import type { Effect, EffectContext, Frame, Wand, WandPointerEvent } from './types';

/** A configuration store for tests that merges only the defaults and the runtime patches. */
export function fakeStore(options: ConfigStoreOptions<AnyConfig>): ConfigStore<AnyConfig> & {
  destroyed: boolean;
} {
  let config: AnyConfig = {};
  for (const section of options.sections) {
    const values: Record<string, unknown> = { enabled: true };
    for (const [key, definition] of Object.entries(section.schema))
      values[key] = definition.default;
    config[section.name] = { ...values, ...(options.defaults?.[section.name] ?? {}) };
  }
  const listeners = new Set<(next: AnyConfig, previous: AnyConfig) => void>();
  const store = {
    destroyed: false,
    ready: Promise.resolve(),
    sections: options.sections,
    get: () => config,
    set(patch: ConfigPatch<AnyConfig>) {
      const previous = config;
      config = { ...config };
      for (const [name, values] of Object.entries(patch)) {
        config[name] = { ...config[name], ...values };
      }
      for (const listener of listeners) listener(config, previous);
    },
    reset() {},
    save: () => Promise.resolve(),
    export: () => ({ v: 1, ...config }),
    import() {},
    subscribe(listener: (next: AnyConfig, previous: AnyConfig) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy() {
      store.destroyed = true;
    },
  };
  return store;
}

/** The state of the canvas that a fake effect sees before it draws. */
export interface DrawRecord {
  readonly name: string;
  readonly alpha: number;
  readonly composite: string;
  readonly transform: DOMMatrix;
  readonly frame: Frame;
}

interface FakeSchema extends Schema {
  readonly size: NumberField;
  readonly tint: ColorField<true>;
}

/** An effect for tests that records each call. */
export interface FakeEffect extends Effect<string, FakeSchema> {
  idle: boolean;
  throwOnDraw: boolean;
  context: EffectContext | undefined;
  readonly configured: Record<string, unknown>[];
  readonly pointers: WandPointerEvent[];
  readonly frames: Frame[];
  cleared: number;
  destroyed: number;
}

/**
 * Creates an effect for tests.
 *
 * @param name - The section name.
 * @param layer - The draw layer.
 * @param draws - Receives a record for each draw.
 * @param composite - The composite operation.
 */
export function fakeEffect(
  name: string,
  layer = 0,
  draws: DrawRecord[] = [],
  composite?: GlobalCompositeOperation,
): FakeEffect {
  const schema: FakeSchema = {
    size: field.number({
      label: 'Size',
      description: 'Size.',
      default: 5,
      min: 0,
      max: 10,
      step: 1,
    }),
    tint: field.color<true>({ label: 'Tint', description: 'Tint.', default: null, nullable: true }),
  };
  const effect: FakeEffect = {
    name,
    schema,
    layer,
    ...(composite ? { composite } : {}),
    idle: false,
    throwOnDraw: false,
    context: undefined,
    configured: [],
    pointers: [],
    frames: [],
    cleared: 0,
    destroyed: 0,
    setup(context) {
      effect.context = context;
    },
    configure(config) {
      effect.configured.push(config);
    },
    pointer(event) {
      effect.pointers.push(event);
    },
    update(frame) {
      effect.frames.push({ ...frame });
    },
    draw(context, frame) {
      if (effect.throwOnDraw) throw new Error(`${name} failed`);
      draws.push({
        name,
        alpha: context.globalAlpha,
        composite: context.globalCompositeOperation,
        transform: context.getTransform(),
        frame: { ...frame },
      });
      context.globalAlpha = 0.25;
      context.globalCompositeOperation = 'xor';
      context.translate(13, 17);
    },
    isIdle: () => effect.idle,
    clear() {
      effect.cleared++;
    },
    destroy() {
      effect.destroyed++;
    },
  };
  return effect;
}

/**
 * Creates a wand with the fake store.
 *
 * @param options - The options of the wand.
 */
export function createTestWand(options: EngineOptions): Wand<AnyConfig> {
  return createWandWith(fakeStore, options, () => []);
}
