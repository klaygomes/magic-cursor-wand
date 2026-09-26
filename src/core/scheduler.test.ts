import { describe, expect, it } from 'vitest';
import { createManualScheduler, joinFrameLoop } from './scheduler';

describe('createManualScheduler', () => {
  it('runs the pending callbacks with the new time', () => {
    const scheduler = createManualScheduler(100);
    const times: number[] = [];
    scheduler.request((now) => times.push(now));
    scheduler.advance(10);
    expect(times).toEqual([110]);
    expect(scheduler.pending).toBe(0);
  });

  it('runs a callback that a callback requests in the next frame only', () => {
    const scheduler = createManualScheduler();
    let count = 0;
    const step = (): void => {
      count++;
      scheduler.request(step);
    };
    scheduler.request(step);
    scheduler.frames(3);
    expect(count).toBe(3);
  });

  it('cancels a callback', () => {
    const scheduler = createManualScheduler();
    let called = false;
    const handle = scheduler.request(() => {
      called = true;
    });
    scheduler.cancel(handle);
    scheduler.advance();
    expect(called).toBe(false);
  });
});

describe('joinFrameLoop', () => {
  it('shares one frame request between the subscribers', () => {
    const scheduler = createManualScheduler();
    const ticks: string[] = [];
    const first = joinFrameLoop(scheduler, {
      tick: () => {
        ticks.push('a');
        return true;
      },
    });
    const second = joinFrameLoop(scheduler, {
      tick: () => {
        ticks.push('b');
        return true;
      },
    });
    first.wake();
    second.wake();
    expect(scheduler.pending).toBe(1);
    scheduler.advance();
    expect(ticks).toEqual(['a', 'b']);
    first.release();
    second.release();
    expect(scheduler.pending).toBe(0);
  });

  it('sleeps a subscriber that returns false and cancels the frame without awake subscribers', () => {
    const scheduler = createManualScheduler();
    let awake = true;
    const handle = joinFrameLoop(scheduler, { tick: () => awake });
    handle.wake();
    scheduler.advance();
    expect(handle.isAwake()).toBe(true);
    awake = false;
    scheduler.advance();
    expect(handle.isAwake()).toBe(false);
    expect(scheduler.pending).toBe(0);
    handle.wake();
    handle.sleep();
    expect(scheduler.pending).toBe(0);
    handle.release();
  });

  it('ignores wake after release', () => {
    const scheduler = createManualScheduler();
    const handle = joinFrameLoop(scheduler, { tick: () => true });
    handle.release();
    handle.wake();
    expect(scheduler.pending).toBe(0);
  });
});
