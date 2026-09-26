import { cleanup, render } from '@testing-library/react';
import { StrictMode, useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Wand } from '../core/types';
import type { CreateWandOptions } from '../core/wand';
import { useWand } from './index';

interface MockWand {
  readonly options: Record<string, unknown>;
  readonly setConfig: ReturnType<typeof vi.fn>;
  readonly destroy: ReturnType<typeof vi.fn>;
}

const created: MockWand[] = [];

vi.mock('../core/wand', () => ({
  createWand: vi.fn((options: Record<string, unknown> = {}) => {
    const wand: MockWand = { options, setConfig: vi.fn(), destroy: vi.fn() };
    created.push(wand);
    return wand;
  }),
}));

type AnyOptions = CreateWandOptions<[], []>;

let seen: (Wand<unknown> | null)[] = [];

function Overlay({ options }: { options: AnyOptions }) {
  const wand = useWand(options);
  seen.push(wand as Wand<unknown> | null);
  return null;
}

function Container({ options }: { options: AnyOptions }) {
  const ref = useRef<HTMLDivElement>(null);
  useWand(options, ref);
  return <div data-testid="target" ref={ref} />;
}

function live(): MockWand[] {
  return created.filter((wand) => wand.destroy.mock.calls.length === 0);
}

afterEach(() => {
  cleanup();
  created.length = 0;
  seen = [];
});

describe('useWand', () => {
  it('creates one live wand in StrictMode and destroys it on unmount', () => {
    const view = render(
      <StrictMode>
        <Overlay options={{ zIndex: 5 }} />
      </StrictMode>,
    );
    expect(live()).toHaveLength(1);
    expect(created.length).toBeGreaterThanOrEqual(1);
    for (const wand of created.slice(0, -1)) expect(wand.destroy).toHaveBeenCalledTimes(1);
    expect(live()[0]?.options.zIndex).toBe(5);
    expect(seen[seen.length - 1]).toBe(live()[0]);

    view.unmount();
    expect(live()).toHaveLength(0);
  });

  it('returns null before the wand exists', () => {
    render(<Overlay options={{}} />);
    expect(seen[0]).toBeNull();
    expect(seen[seen.length - 1]).toBe(created[0]);
  });

  it('passes the ref element as the target in container mode', () => {
    const view = render(
      <StrictMode>
        <Container options={{}} />
      </StrictMode>,
    );
    expect(live()[0]?.options.target).toBe(view.getByTestId('target'));
  });

  it('reads the creation options one time', () => {
    const view = render(<Overlay options={{ zIndex: 1 }} />);
    view.rerender(<Overlay options={{ zIndex: 2 }} />);
    expect(created).toHaveLength(1);
    expect(created[0]?.options.zIndex).toBe(1);
  });

  it('calls setConfig only with the sections that changed', () => {
    const config = (chalk: number, glitter: number) =>
      ({ config: { chalk: { size: chalk }, glitter: { size: glitter } } }) as AnyOptions;
    const view = render(
      <StrictMode>
        <Overlay options={config(10, 5)} />
      </StrictMode>,
    );
    const wand = live()[0];
    if (!wand) throw new Error('No wand exists.');
    expect(wand.options.config).toEqual({ chalk: { size: 10 }, glitter: { size: 5 } });
    expect(wand.setConfig).not.toHaveBeenCalled();

    view.rerender(
      <StrictMode>
        <Overlay options={config(10, 5)} />
      </StrictMode>,
    );
    expect(wand.setConfig).not.toHaveBeenCalled();

    view.rerender(
      <StrictMode>
        <Overlay options={config(12, 5)} />
      </StrictMode>,
    );
    expect(wand.setConfig).toHaveBeenCalledTimes(1);
    expect(wand.setConfig).toHaveBeenLastCalledWith({ chalk: { size: 12 } });
  });
});
