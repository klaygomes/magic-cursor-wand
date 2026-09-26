import { describe, expect, it } from 'vitest';
import { createEventBus } from './bus';

describe('createEventBus', () => {
  it('dispatches synchronously to each handler in order', () => {
    const bus = createEventBus();
    const calls: string[] = [];
    bus.on('burst', () => calls.push('first'));
    bus.on('burst', () => calls.push('second'));
    bus.emit('burst', { x: 0, y: 0, strength: 1 });
    expect(calls).toEqual(['first', 'second']);
  });

  it('gives the same payload object to each handler', () => {
    const bus = createEventBus();
    const payload = { x: 1, y: 2, strength: 3 };
    const received: unknown[] = [];
    bus.on('burst', (value) => received.push(value));
    bus.on('burst', (value) => received.push(value));
    bus.emit('burst', payload);
    expect(received[0]).toBe(payload);
    expect(received[1]).toBe(payload);
  });

  it('removes a handler with the returned function', () => {
    const bus = createEventBus();
    let count = 0;
    const off = bus.on('burst', () => count++);
    off();
    off();
    bus.emit('burst', { x: 0, y: 0, strength: 1 });
    expect(count).toBe(0);
  });

  it('isolates a handler that throws when an error callback exists', () => {
    const errors: unknown[] = [];
    const bus = createEventBus((error) => errors.push(error));
    let reached = false;
    bus.on('burst', () => {
      throw new Error('fail');
    });
    bus.on('burst', () => {
      reached = true;
    });
    bus.emit('burst', { x: 0, y: 0, strength: 1 });
    expect(reached).toBe(true);
    expect(errors).toHaveLength(1);
  });

  it('removes all handlers with clear', () => {
    const bus = createEventBus();
    let count = 0;
    bus.on('burst', () => count++);
    bus.clear();
    bus.emit('burst', { x: 0, y: 0, strength: 1 });
    expect(count).toBe(0);
  });
});
