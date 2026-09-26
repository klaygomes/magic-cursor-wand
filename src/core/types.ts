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

export interface Frame {
  readonly dt: number;
  readonly time: number;
  readonly reducedMotion: boolean;
  readonly width: number;
  readonly height: number;
  readonly scrollX: number;
  readonly scrollY: number;
}

export interface Point {
  x: number;
  y: number;
}

export type WandPointerPhase = 'down' | 'move' | 'up' | 'cancel' | 'leave' | 'tap';

export interface WandPointerEvent {
  readonly phase: WandPointerPhase;
  readonly x: number;
  readonly y: number;
  readonly pointerType: string;
  readonly drawing: boolean;
  readonly samples: readonly Point[];
}

export interface WandEvents {
  burst: { x: number; y: number; strength: number };
}

export interface EventBus {
  emit<K extends keyof WandEvents>(type: K, payload: WandEvents[K]): void;
  on<K extends keyof WandEvents>(type: K, handler: (payload: WandEvents[K]) => void): () => void;
}

export interface EffectContext {
  readonly bus: EventBus;
  random(): number;
  createCanvas(width: number, height: number): HTMLCanvasElement;
  reportError(error: unknown): void;
}

export type EffectConfig<S extends Schema> = Resolved<InferSchema<S>>;

export interface Effect<N extends string = string, S extends Schema = Schema>
  extends Section<N, S> {
  readonly layer: number;
  readonly composite?: GlobalCompositeOperation;
  setup(context: EffectContext): void;
  configure(config: EffectConfig<S>, theme: ThemeConfig): void;
  pointer?(event: WandPointerEvent): void;
  update(frame: Frame): void;
  draw(context: CanvasRenderingContext2D, frame: Frame): void;
  isIdle(): boolean;
  clear(): void;
  destroy(): void;
}

export interface PluginContext<C = unknown> {
  readonly wand: Wand<C>;
  readonly bus: EventBus;
  readonly surface: SurfaceInfo;
  onPointer(handler: (event: WandPointerEvent) => void): () => void;
}

export interface Plugin<N extends string = string, S extends Schema = Schema>
  extends Section<N, S> {
  setup(context: PluginContext): void;
  configure?(config: EffectConfig<S>, theme: ThemeConfig): void;
  destroy?(): void;
}

export interface SurfaceInfo {
  readonly mode: 'overlay' | 'container';
  readonly element: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  toClient(point: Point): Point;
}

export type DrawPredicate = (event: PointerEvent) => boolean;

export interface Scheduler {
  now(): number;
  request(callback: (now: number) => void): number;
  cancel(handle: number): void;
}

export type AnySection = Effect | Plugin;

export interface WandOptions<Sections extends readonly AnySection[] = readonly AnySection[]> {
  readonly target?: HTMLElement;
  readonly effects?: readonly Effect[];
  readonly plugins?: readonly Plugin[];
  readonly config?: ConfigPatch<ComposeConfig<Sections>>;
  readonly providers?: readonly ConfigProvider[];
  readonly locked?: readonly string[];
  readonly shouldDraw?: DrawPredicate;
  readonly ignoreSelector?: string;
  readonly zIndex?: number;
  readonly touchAction?: string;
  readonly startAfter?: 'ready' | number;
  readonly autosaveDebounceMs?: number;
  readonly silent?: boolean;
  readonly random?: () => number;
  readonly scheduler?: Scheduler;
}

export interface WandLifecycleEvents<C> {
  config: { next: C; previous: C };
  error: WandError;
  ready: undefined;
}

export interface Wand<C = unknown> {
  readonly ready: Promise<void>;
  readonly sections: readonly Section[];
  getConfig(): C;
  setConfig(patch: ConfigPatch<C>): void;
  reset(): void;
  save(options?: SaveOptions): Promise<void>;
  exportConfig(): ConfigDocument;
  importConfig(document: unknown): void;
  on<K extends keyof WandLifecycleEvents<C>>(
    type: K,
    handler: (payload: WandLifecycleEvents<C>[K]) => void,
  ): () => void;
  start(): void;
  stop(): void;
  destroy(): void;
}
