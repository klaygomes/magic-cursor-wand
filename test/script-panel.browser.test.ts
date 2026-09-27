import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Wand } from '../src/core/types';
import { startFromAttributes } from '../src/iife';

let wand: Wand | undefined;

afterEach(() => {
  vi.unstubAllGlobals();
  wand?.destroy();
  wand = undefined;
  document.body.replaceChildren();
});

describe('script tag panel attributes', () => {
  it('starts a wand from data-wand-panel alone', () => {
    wand = startFromAttributes({ wandPanel: '' });
    expect(wand).toBeDefined();
  });

  it('puts the panel in the element of data-wand-panel-container', () => {
    const dock = document.createElement('aside');
    dock.id = 'dock';
    document.body.append(dock);
    wand = startFromAttributes({ wandPanelHotkey: 'Alt+Shift+W', wandPanelContainer: '#dock' });
    expect(dock.querySelector('[data-wand-ui]')).not.toBeNull();
  });

  it('adds the cursor plugin only on a device with a pointer that can hover', () => {
    const noop = (): void => {};
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addListener: noop,
      removeListener: noop,
      addEventListener: noop,
      removeEventListener: noop,
    }));
    wand = startFromAttributes({ wandCursor: 'replace' });
    expect(wand?.sections.map((section) => section.name)).not.toContain('cursor');
  });
});
