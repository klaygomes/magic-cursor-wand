import type { Scheduler } from './types';

let browserScheduler: Scheduler | undefined;

/**
 * Gets the scheduler that uses `requestAnimationFrame` and `performance.now`.
 *
 * @returns The shared browser scheduler.
 */
export function getDefaultScheduler(): Scheduler {
  browserScheduler ??= {
    now: () => performance.now(),
    request: (callback) => requestAnimationFrame(callback),
    cancel: (handle) => cancelAnimationFrame(handle),
  };
  return browserScheduler;
}

/** A scheduler that moves the time only when a test tells it to. */
export interface ManualScheduler extends Scheduler {
  /** The number of callbacks that wait for the next frame. */
  readonly pending: number;
  /**
   * Moves the time forward and runs the callbacks that wait for a frame.
   *
   * @param ms - The time between the frames. The default is one frame at 60 fps.
   */
  advance(ms?: number): void;
  /**
   * Runs a number of frames with the same interval.
   *
   * @param count - The number of frames.
   * @param ms - The time between the frames. The default is one frame at 60 fps.
   */
  frames(count: number, ms?: number): void;
}

const FRAME_MS = 1000 / 60;

/**
 * Creates a scheduler for tests that runs one frame for each call to `advance`.
 *
 * @param start - The start time in milliseconds.
 * @returns The manual scheduler.
 * @example
 * const scheduler = createManualScheduler();
 * const wand = createWand({ scheduler });
 * scheduler.frames(10);
 */
export function createManualScheduler(start = 0): ManualScheduler {
  let time = start;
  let nextHandle = 1;
  let queue = new Map<number, (now: number) => void>();

  const advance = (ms = FRAME_MS): void => {
    time += ms;
    const due = queue;
    queue = new Map();
    for (const callback of due.values()) callback(time);
  };

  return {
    get pending() {
      return queue.size;
    },
    now: () => time,
    request(callback) {
      const handle = nextHandle++;
      queue.set(handle, callback);
      return handle;
    },
    cancel(handle) {
      queue.delete(handle);
    },
    advance,
    frames(count, ms) {
      for (let index = 0; index < count; index++) advance(ms);
    },
  };
}

/** The shared state of the page that all wand instances read. */
export interface Environment {
  readonly hidden: boolean;
  readonly prefersReducedMotion: boolean;
}

type EnvironmentListener = (environment: Environment) => void;

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const environment = { hidden: false, prefersReducedMotion: false };
const environmentListeners = new Set<EnvironmentListener>();
let detachEnvironment: (() => void) | undefined;

function notifyEnvironment(): void {
  for (const listener of environmentListeners) listener(environment);
}

function attachEnvironment(): () => void {
  if (typeof document === 'undefined') return () => {};
  const onVisibility = (): void => {
    environment.hidden = document.hidden;
    notifyEnvironment();
  };
  environment.hidden = document.hidden;
  document.addEventListener('visibilitychange', onVisibility);

  const query = typeof matchMedia === 'function' ? matchMedia(REDUCED_MOTION_QUERY) : undefined;
  const onMotion = (): void => {
    environment.prefersReducedMotion = query?.matches ?? false;
    notifyEnvironment();
  };
  environment.prefersReducedMotion = query?.matches ?? false;
  if (query?.addEventListener) query.addEventListener('change', onMotion);
  else query?.addListener(onMotion);

  return () => {
    document.removeEventListener('visibilitychange', onVisibility);
    if (query?.removeEventListener) query.removeEventListener('change', onMotion);
    else query?.removeListener(onMotion);
  };
}

/**
 * Adds a listener to the shared page state. The first listener attaches the `window` listeners and the last release removes them.
 *
 * @param listener - Receives the state when it changes.
 * @returns The current state and a function that removes the listener.
 */
export function acquireEnvironment(listener: EnvironmentListener): {
  readonly environment: Environment;
  readonly release: () => void;
} {
  environmentListeners.add(listener);
  detachEnvironment ??= attachEnvironment();
  let released = false;
  return {
    environment,
    release() {
      if (released) return;
      released = true;
      environmentListeners.delete(listener);
      if (environmentListeners.size > 0) return;
      detachEnvironment?.();
      detachEnvironment = undefined;
    },
  };
}

/** A participant of the shared frame loop. */
export interface FrameSubscriber {
  /**
   * Runs one frame.
   *
   * @returns `true` to stay awake for the next frame, `false` to sleep.
   */
  tick(now: number): boolean;
}

/** Controls the membership of one subscriber in a shared frame loop. */
export interface LoopHandle {
  wake(): void;
  sleep(): void;
  isAwake(): boolean;
  release(): void;
}

interface FrameLoop {
  readonly awake: Set<FrameSubscriber>;
  references: number;
  handle: number | undefined;
  hidden: boolean;
  releaseEnvironment: () => void;
}

const loops = new Map<Scheduler, FrameLoop>();

function schedule(scheduler: Scheduler, loop: FrameLoop): void {
  if (loop.handle !== undefined || loop.hidden || loop.awake.size === 0) return;
  loop.handle = scheduler.request((now) => {
    loop.handle = undefined;
    for (const subscriber of loop.awake) {
      if (!subscriber.tick(now)) loop.awake.delete(subscriber);
    }
    schedule(scheduler, loop);
  });
}

function unschedule(scheduler: Scheduler, loop: FrameLoop): void {
  if (loop.handle === undefined) return;
  scheduler.cancel(loop.handle);
  loop.handle = undefined;
}

/**
 * Adds a subscriber to the frame loop that all instances with the same scheduler share.
 *
 * @param scheduler - The scheduler of the loop.
 * @param subscriber - The participant that runs in each frame.
 * @returns A handle that wakes, sleeps and releases the subscriber.
 */
export function joinFrameLoop(scheduler: Scheduler, subscriber: FrameSubscriber): LoopHandle {
  let loop = loops.get(scheduler);
  if (!loop) {
    const created: FrameLoop = {
      awake: new Set(),
      references: 0,
      handle: undefined,
      hidden: false,
      releaseEnvironment: () => {},
    };
    const { environment: state, release } = acquireEnvironment(({ hidden }) => {
      created.hidden = hidden;
      if (hidden) unschedule(scheduler, created);
      else schedule(scheduler, created);
    });
    created.hidden = state.hidden;
    created.releaseEnvironment = release;
    loops.set(scheduler, created);
    loop = created;
  }
  const active = loop;
  active.references++;
  let released = false;

  const sleep = (): void => {
    active.awake.delete(subscriber);
    if (active.awake.size === 0) unschedule(scheduler, active);
  };

  return {
    wake() {
      if (released) return;
      active.awake.add(subscriber);
      schedule(scheduler, active);
    },
    sleep,
    isAwake: () => active.awake.has(subscriber),
    release() {
      if (released) return;
      released = true;
      sleep();
      active.references--;
      if (active.references > 0) return;
      unschedule(scheduler, active);
      active.releaseEnvironment();
      loops.delete(scheduler);
    },
  };
}
