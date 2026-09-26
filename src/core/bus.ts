import type { EventBus } from './types';

type Handler = (payload: never) => void;

/** An event bus that can also remove all of its handlers. */
export interface DisposableEventBus extends EventBus {
  clear(): void;
}

/**
 * Creates a synchronous event bus for the events in `WandEvents`.
 *
 * @param onError - Receives the errors that handlers throw. Without it, the error goes up to the caller of `emit`.
 * @returns The event bus.
 * @example
 * const bus = createEventBus();
 * bus.on('burst', ({ x, y }) => spawn(x, y));
 * bus.emit('burst', { x: 10, y: 20, strength: 1 });
 */
export function createEventBus(onError?: (error: unknown) => void): DisposableEventBus {
  const handlers = new Map<PropertyKey, readonly Handler[]>();

  return {
    emit(type, payload) {
      const list = handlers.get(type);
      if (!list) return;
      for (const handler of list) {
        if (!onError) {
          (handler as (value: typeof payload) => void)(payload);
          continue;
        }
        try {
          (handler as (value: typeof payload) => void)(payload);
        } catch (error) {
          onError(error);
        }
      }
    },
    on(type, handler) {
      const entry = handler as Handler;
      handlers.set(type, [...(handlers.get(type) ?? []), entry]);
      return () => {
        const list = handlers.get(type);
        if (!list) return;
        const next = list.filter((item) => item !== entry);
        if (next.length > 0) handlers.set(type, next);
        else handlers.delete(type);
      };
    },
    clear() {
      handlers.clear();
    },
  };
}

/** Lists the handlers for the events of a typed emitter. */
export interface Emitter<Events> {
  emit<K extends keyof Events>(type: K, payload: Events[K]): void;
  on<K extends keyof Events>(type: K, handler: (payload: Events[K]) => void): () => void;
  clear(): void;
}

/**
 * Creates a synchronous emitter for a map of event types.
 *
 * @returns The emitter.
 */
export function createEmitter<Events>(): Emitter<Events> {
  return createEventBus() as unknown as Emitter<Events>;
}
