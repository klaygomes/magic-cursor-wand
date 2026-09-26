import type { Schema } from '../config/types';
import type {
  EffectConfig,
  EffectContext,
  EventBus,
  Frame,
  WandEvents,
  WandPointerEvent,
  WandPointerPhase,
} from '../core/types';

/**
 * Makes a seeded random function with the mulberry32 algorithm.
 *
 * @param seed - The seed.
 * @returns A function that gives the same values for the same seed.
 */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A synchronous event bus that also records the emitted events. */
export interface TestBus extends EventBus {
  readonly bursts: WandEvents['burst'][];
}

/**
 * Makes a synchronous event bus for tests.
 *
 * @returns The bus. It keeps a copy of each `burst` payload.
 */
export function createTestBus(): TestBus {
  const handlers = new Map<string, Set<(payload: never) => void>>();
  const bursts: WandEvents['burst'][] = [];
  return {
    bursts,
    emit(type, payload) {
      if (type === 'burst') bursts.push({ ...payload });
      for (const handler of handlers.get(type) ?? []) handler(payload as never);
    },
    on(type, handler) {
      const set = handlers.get(type) ?? new Set();
      set.add(handler as (payload: never) => void);
      handlers.set(type, set);
      return () => set.delete(handler as (payload: never) => void);
    },
  };
}

/** The options of {@link createTestContext}. */
export interface TestContextOptions {
  readonly seed?: number;
  readonly bus?: TestBus;
  readonly createCanvas?: (width: number, height: number) => HTMLCanvasElement;
}

/** An effect context for tests. */
export interface TestContext extends EffectContext {
  readonly bus: TestBus;
  readonly errors: unknown[];
}

/**
 * Makes an effect context with a seeded random function.
 *
 * @param options - The seed, the bus and the canvas factory.
 * @returns The context.
 */
export function createTestContext(options: TestContextOptions = {}): TestContext {
  const random = seededRandom(options.seed ?? 1);
  const errors: unknown[] = [];
  const createCanvas =
    options.createCanvas ??
    ((width: number, height: number) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      return canvas;
    });
  return {
    bus: options.bus ?? createTestBus(),
    errors,
    random,
    createCanvas,
    reportError: (error) => errors.push(error),
  };
}

/** A call that a fake 2D context records. */
export interface RecordedCall {
  readonly method: string;
  readonly args: readonly unknown[];
  readonly globalAlpha: number;
}

/** A 2D context that records calls, for tests without a real canvas. */
export interface FakeContext2d {
  readonly calls: RecordedCall[];
  readonly context: CanvasRenderingContext2D;
  readonly canvas: HTMLCanvasElement;
}

const IDENTITY = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

/**
 * Makes a canvas with a fake 2D context that records each method call.
 *
 * @param width - The width of the canvas.
 * @param height - The height of the canvas.
 * @returns The canvas, its context and the list of calls.
 */
export function createFakeCanvas(width = 300, height = 200): FakeContext2d {
  const calls: RecordedCall[] = [];
  const state: Record<string | symbol, unknown> = { globalAlpha: 1 };
  const canvas = { width, height } as Record<string, unknown>;
  const context = new Proxy(state, {
    get(target, key) {
      if (key === 'canvas') return canvas;
      if (key in target) return target[key];
      return (...args: unknown[]) => {
        calls.push({ method: String(key), args, globalAlpha: Number(target.globalAlpha) });
        if (key === 'getTransform') return { ...IDENTITY };
        if (key === 'createRadialGradient') return { addColorStop() {} };
        return undefined;
      };
    },
    set(target, key, value) {
      target[key] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  canvas.getContext = () => context;
  return { calls, context, canvas: canvas as unknown as HTMLCanvasElement };
}

/**
 * Makes the resolved default configuration of a schema.
 *
 * @param schema - The schema.
 * @param color - The color for nullable color fields.
 * @returns The configuration.
 */
export function defaultsOf<S extends Schema>(schema: S, color = '#ffffff'): EffectConfig<S> {
  const values: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(schema)) {
    values[key] = entry.default === null ? color : entry.default;
  }
  return values as EffectConfig<S>;
}

/**
 * Makes a frame at 60 frames per second.
 *
 * @param index - The number of the frame.
 * @param overrides - Values that replace the defaults.
 * @returns The frame.
 */
export function frameAt(index: number, overrides: Partial<Frame> = {}): Frame {
  return {
    dt: 1,
    time: index * (1000 / 60),
    reducedMotion: false,
    width: 300,
    height: 200,
    scrollX: 0,
    scrollY: 0,
    ...overrides,
  };
}

/**
 * Makes a pointer event.
 *
 * @param phase - The phase.
 * @param x - The horizontal document position.
 * @param y - The vertical document position.
 * @param overrides - Values that replace the defaults.
 * @returns The event.
 */
export function pointerAt(
  phase: WandPointerPhase,
  x: number,
  y: number,
  overrides: Partial<WandPointerEvent> = {},
): WandPointerEvent {
  return { phase, x, y, pointerType: 'mouse', drawing: true, samples: [], ...overrides };
}
