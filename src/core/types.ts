import type {
  ComposeConfig,
  ConfigDocument,
  ConfigPatch,
  ConfigProvider,
  InferSchema,
  Resolved,
  SaveOptions,
  Schema,
  Section,
  ThemeConfig,
  WandError,
} from '../config/types';

/** The data that the engine gives to each effect in one frame. */
export interface Frame {
  /** The time since the last frame, in frames at 60 fps. The maximum value is 3. */
  readonly dt: number;
  /** The time of the frame in milliseconds, from the scheduler. */
  readonly time: number;
  /** True if the effects must use reduced motion. */
  readonly reducedMotion: boolean;
  /** The CSS width of the canvas. */
  readonly width: number;
  /** The CSS height of the canvas. */
  readonly height: number;
  /** The horizontal scroll offset of the page or the container. */
  readonly scrollX: number;
  /** The vertical scroll offset of the page or the container. */
  readonly scrollY: number;
}

/** A position in document coordinates. */
export interface Point {
  x: number;
  y: number;
}

/** The phase of a pointer event. A `tap` is a short touch in overlay mode. */
export type WandPointerPhase = 'down' | 'move' | 'up' | 'cancel' | 'leave' | 'tap';

/** A pointer event in document coordinates. */
export interface WandPointerEvent {
  /** The phase of the event. */
  readonly phase: WandPointerPhase;
  /** The horizontal document position. */
  readonly x: number;
  /** The vertical document position. */
  readonly y: number;
  /** The pointer type of the browser event, for example `mouse` or `touch`. */
  readonly pointerType: string;
  /** True if the event is part of a chalk stroke. */
  readonly drawing: boolean;
  /** The coalesced positions of the event, in document coordinates. */
  readonly samples: readonly Point[];
}

/**
 * The events of the event bus. Add events with module augmentation.
 *
 * @example
 * declare module 'magic-cursor-wand' {
 *   interface WandEvents { ripple: { x: number; y: number } }
 * }
 */
export interface WandEvents {
  /** An intent to show a burst of particles at a position. */
  burst: { x: number; y: number; strength: number };
}

/** A synchronous event bus that the effects and the plugins of a wand share. */
export interface EventBus {
  /** Sends the payload to each handler of the event type. */
  emit<K extends keyof WandEvents>(type: K, payload: WandEvents[K]): void;
  /** Adds a handler. Returns a function that removes the handler. */
  on<K extends keyof WandEvents>(type: K, handler: (payload: WandEvents[K]) => void): () => void;
}

/** The services that the engine gives to an effect in `setup`. */
export interface EffectContext {
  /** The event bus of the wand. */
  readonly bus: EventBus;
  /** Gives a random value from 0 to 1. Use it in place of `Math.random`. */
  random(): number;
  /** Makes an offscreen canvas, for example for a sprite. */
  createCanvas(width: number, height: number): HTMLCanvasElement;
  /** Sends an error to the error events of the wand. */
  reportError(error: unknown): void;
}

/** The resolved configuration values that an effect or a plugin receives. */
export type EffectConfig<S extends Schema> = Resolved<InferSchema<S>>;

/** An effect draws on the canvas of the wand. It is also a configuration section. */
export interface Effect<N extends string = string, S extends Schema = Schema>
  extends Section<N, S> {
  /** The draw order. The engine draws a low layer first. */
  readonly layer: number;
  /** The composite operation for `draw`. The default is `source-over`. */
  readonly composite?: GlobalCompositeOperation;
  /** Gets the services of the engine. The engine calls it one time. */
  setup(context: EffectContext): void;
  /** Gets the resolved values of the section after each change. */
  configure(config: EffectConfig<S>, theme: ThemeConfig): void;
  /** Gets each pointer event. */
  pointer?(event: WandPointerEvent): void;
  /** Moves the state forward by one frame. */
  update(frame: Frame): void;
  /** Draws the state. The transform of the context converts document coordinates. */
  draw(context: CanvasRenderingContext2D, frame: Frame): void;
  /** Tells if the effect has nothing to draw. */
  isIdle(): boolean;
  /** Removes the state. The engine calls it when the effect becomes disabled. */
  clear(): void;
  /** Releases all resources. */
  destroy(): void;
}

/** The services that the engine gives to a plugin in `setup`. */
export interface PluginContext<C = unknown> {
  /** The wand that owns the plugin. */
  readonly wand: Wand<C>;
  /** The event bus of the wand. */
  readonly bus: EventBus;
  /** The surface of the wand. */
  readonly surface: SurfaceInfo;
  /** Adds a pointer handler. Returns a function that removes the handler. */
  onPointer(handler: (event: WandPointerEvent) => void): () => void;
  /** Sends an error to the error events of the wand. */
  reportError(error: unknown): void;
}

/** A plugin adds a feature that does not draw on the canvas. It is also a configuration section. */
export interface Plugin<N extends string = string, S extends Schema = Schema>
  extends Section<N, S> {
  /** Gets the services of the engine. The engine calls it one time. */
  setup(context: PluginContext): void;
  /** Gets the resolved values of the section after each change. The engine does not call it while `enabled` is false. */
  configure?(config: EffectConfig<S>, theme: ThemeConfig): void;
  /** Releases all resources. */
  destroy?(): void;
}

/** The public data of the surface of a wand. */
export interface SurfaceInfo {
  /** The mode of the surface. */
  readonly mode: 'overlay' | 'container';
  /** The root element in overlay mode, or the target element in container mode. */
  readonly element: HTMLElement;
  /** The canvas of the wand. */
  readonly canvas: HTMLCanvasElement;
  /** Converts a document position to a client position. */
  toClient(point: Point): Point;
}

/** Decides if a `pointerdown` event starts a chalk stroke. */
export type DrawPredicate = (event: PointerEvent) => boolean;

/** The clock and the frame requests of a wand. */
export interface Scheduler {
  /** Gives the current time in milliseconds. */
  now(): number;
  /** Requests a call for the next frame. Returns a handle. */
  request(callback: (now: number) => void): number;
  /** Cancels a request. */
  cancel(handle: number): void;
}

/** An effect or a plugin. */
export type AnySection = Effect | Plugin;

/** The options of `createWand`. */
export interface WandOptions<Sections extends readonly AnySection[] = readonly AnySection[]> {
  /** The element for container mode. Without it, the mode is overlay. */
  readonly target?: HTMLElement;
  /** The effects. The default is the cloud, chalk and glitter effects. */
  readonly effects?: readonly Effect[];
  /** The plugins. */
  readonly plugins?: readonly Plugin[];
  /** The configuration layer above the schema defaults. */
  readonly config?: ConfigPatch<ComposeConfig<Sections>>;
  /** The configuration providers, from low to high precedence. */
  readonly providers?: readonly ConfigProvider[];
  /** The paths that the providers and `setConfig` cannot change, for example `glitter.maxParticles`. */
  readonly locked?: readonly string[];
  /** Decides if a press starts a chalk stroke. The default is `drawOnPress`. */
  readonly shouldDraw?: DrawPredicate;
  /** A press on an element that matches this selector does not start a stroke. */
  readonly ignoreSelector?: string;
  /** The stack order of the canvas. The default is `2147483647`. */
  readonly zIndex?: number;
  /** The `touch-action` value of the target in container mode. The default is `none`. */
  readonly touchAction?: string;
  /** Delays the first frame until `ready`, or for the given time in milliseconds. */
  readonly startAfter?: 'ready' | number;
  /** The time between the last change and the autosave, in milliseconds. The default is 500. */
  readonly autosaveDebounceMs?: number;
  /** Set to true to stop the console warnings. */
  readonly silent?: boolean;
  /** Replaces `Math.random`, for example with a seeded function in tests. */
  readonly random?: () => number;
  /** Replaces `requestAnimationFrame` and `performance.now`, for example in tests. */
  readonly scheduler?: Scheduler;
}

/** The events of a wand. */
export interface WandLifecycleEvents<C> {
  /** The merged configuration changed. */
  config: { next: C; previous: C };
  /** An error occurred. The wand continues to operate. */
  error: WandError;
  /** All providers settled. */
  ready: undefined;
}

/** A wand that `createWand` makes. */
export interface Wand<C = unknown> {
  /** Resolves after all providers settle. It never rejects. */
  readonly ready: Promise<void>;
  /** The configuration sections, with the theme section first. */
  readonly sections: readonly Section[];
  /** Gives the merged configuration. */
  getConfig(): C;
  /** Changes the runtime layer. Autosave then writes the difference. */
  setConfig(patch: ConfigPatch<C>): void;
  /** Removes the runtime layer and the saved difference of the target provider. */
  reset(): void;
  /** Saves the difference now, to the last writable provider or to the provider `to`. */
  save(options?: SaveOptions): Promise<void>;
  /** Gives the merged configuration as a document. */
  exportConfig(): ConfigDocument;
  /** Puts a document in the runtime layer. */
  importConfig(document: unknown): void;
  /** Adds an event handler. Returns a function that removes the handler. */
  on<K extends keyof WandLifecycleEvents<C>>(
    type: K,
    handler: (payload: WandLifecycleEvents<C>[K]) => void,
  ): () => void;
  /** Starts the frame loop again after `stop`. */
  start(): void;
  /** Stops the frame loop and clears the canvas. */
  stop(): void;
  /** Removes the canvas, the listeners and the frame requests, and stops all requests of the providers. */
  destroy(): void;
}
