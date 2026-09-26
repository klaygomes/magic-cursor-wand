import * as tweakpanePackage from 'tweakpane';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { field } from '../config/field';
import type { Section } from '../config/types';
import type { PluginContext } from '../core/types';
import { createFakeWand, type FakeWand } from './fake_wand';
import { type PanelPlugin, type PanelPluginOptions, panelPlugin } from './plugin';
import type {
  TweakpaneBinding,
  TweakpaneButton,
  TweakpaneContainer,
  TweakpaneModule,
  TweakpanePane,
} from './tweakpane';

type Handler = (event: { value: unknown }) => void;

class FakeBinding implements TweakpaneBinding, TweakpaneButton {
  disabled = false;
  readonly handlers: Handler[] = [];
  constructor(
    readonly object: Record<string, unknown>,
    readonly key: string,
    readonly params: Record<string, unknown>,
  ) {}
  on(_event: string, handler: Handler): this {
    this.handlers.push(handler);
    return this;
  }
  input(value: unknown): void {
    this.object[this.key] = value;
    for (const handler of this.handlers) handler({ value });
  }
  click(): void {
    for (const handler of this.handlers) handler({ value: undefined });
  }
}

class FakeFolder implements TweakpaneContainer {
  readonly folders: FakeFolder[] = [];
  readonly bindings: FakeBinding[] = [];
  readonly buttons = new Map<string, FakeBinding>();
  constructor(readonly title: string) {}
  addFolder(params: { title: string }): FakeFolder {
    const folder = new FakeFolder(params.title);
    this.folders.push(folder);
    return folder;
  }
  addBinding(
    object: Record<string, unknown>,
    key: string,
    params: Record<string, unknown> = {},
  ): FakeBinding {
    const binding = new FakeBinding(object, key, params);
    this.bindings.push(binding);
    return binding;
  }
  addButton(params: { title: string }): FakeBinding {
    const button = new FakeBinding({}, '', {});
    this.buttons.set(params.title, button);
    return button;
  }
  binding(label: string): FakeBinding {
    const found = this.bindings.find((binding) => binding.params.label === label);
    if (!found) throw new Error(`The binding "${label}" does not exist.`);
    return found;
  }
}

class FakePane extends FakeFolder implements TweakpanePane {
  static instances: FakePane[] = [];
  readonly element: HTMLElement = document.createElement('div');
  refreshes = 0;
  disposed = false;
  constructor(readonly config: { container?: HTMLElement; title?: string }) {
    super(config.title ?? '');
    config.container?.appendChild(this.element);
    FakePane.instances.push(this);
  }
  refresh(): void {
    this.refreshes += 1;
  }
  dispose(): void {
    this.disposed = true;
    this.element.remove();
  }
}

const fakeTweakpane: TweakpaneModule = { Pane: FakePane };

const sections: Section[] = [
  {
    name: 'chalk',
    schema: {
      size: field.number({
        label: 'Size',
        description: 'Width.',
        default: 15,
        min: 1,
        max: 50,
        step: 1,
      }),
      color: field.color({ label: 'Color', description: 'Color.', default: null, nullable: true }),
      shape: field.enum({
        label: 'Shape',
        description: 'Shape.',
        default: 'round',
        options: ['round', 'square'],
      }),
    },
  },
  { name: 'panel', schema: {} },
];

const reported: unknown[] = [];

function createContext(wand: FakeWand, element: HTMLElement = document.body): PluginContext {
  return {
    wand,
    bus: { emit() {}, on: () => () => {} },
    surface: {
      mode: 'overlay',
      element,
      canvas: document.createElement('canvas'),
      toClient: (point) => point,
    },
    onPointer: () => () => {},
    reportError: (error) => reported.push(error),
  };
}

let active: PanelPlugin | undefined;

function setup(options: PanelPluginOptions = {}, element?: HTMLElement) {
  const wand = createFakeWand(sections, {
    theme: { color: '#445566', motion: 'auto', maxDpr: 2 },
    chalk: { enabled: true, size: 15, color: null, shape: 'round' },
  });
  const load = vi.fn(async () => fakeTweakpane);
  const plugin = panelPlugin({ load, ...options });
  plugin.setup(createContext(wand, element));
  active = plugin;
  return { wand, load, plugin };
}

function lastPane(): FakePane {
  const pane = FakePane.instances[FakePane.instances.length - 1];
  if (!pane) throw new Error('No pane exists.');
  return pane;
}

function box(): HTMLElement | null {
  return document.querySelector<HTMLElement>('div[data-wand-ui]');
}

afterEach(() => {
  active?.destroy?.();
  active = undefined;
  FakePane.instances = [];
  reported.length = 0;
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('panelPlugin', () => {
  it('is a plugin with an empty schema that loads Tweakpane only on the first open', async () => {
    const { load, plugin } = setup();
    expect(plugin.name).toBe('panel');
    expect(plugin.schema).toEqual({});
    expect(load).not.toHaveBeenCalled();
    expect(plugin.isOpen).toBe(false);

    await plugin.open();
    expect(plugin.isOpen).toBe(true);
    expect(load).toHaveBeenCalledTimes(1);
    expect(box()?.style.display).toBe('block');

    plugin.close();
    expect(plugin.isOpen).toBe(false);
    expect(box()?.style.display).toBe('none');

    await plugin.toggle();
    expect(plugin.isOpen).toBe(true);
    await plugin.toggle();
    expect(plugin.isOpen).toBe(false);
    expect(load).toHaveBeenCalledTimes(1);
    expect(FakePane.instances).toHaveLength(1);
  });

  it('renders one folder for each group with the matching bindings', async () => {
    const { plugin } = setup({ title: 'Wand' });
    await plugin.open();
    const pane = lastPane();
    expect(pane.config.title).toBe('Wand');
    expect(pane.folders.map((folder) => folder.title)).toEqual(['Theme', 'Chalk']);
    const chalk = pane.folders[1];
    if (!chalk) throw new Error('The chalk folder is missing.');
    expect(chalk.binding('Size').params).toMatchObject({ min: 1, max: 50, step: 1 });
    expect(chalk.binding('Shape').params.options).toEqual([
      { text: 'round', value: 'round' },
      { text: 'square', value: 'square' },
    ]);
    expect(chalk.binding('Enabled').object.value).toBe(true);
    expect(chalk.binding('Color').params.view).toBe('color');
    expect([...pane.buttons.keys()]).toEqual(['Reset', 'Import', 'Export', 'Close']);
    expect([...pane.buttons.keys()]).not.toContain('Save');
  });

  it('shows a nullable color as an inherit checkbox and a color control', async () => {
    const { wand, plugin } = setup();
    await plugin.open();
    const chalk = lastPane().folders[1];
    if (!chalk) throw new Error('The chalk folder is missing.');
    const inherit = chalk.binding('Color inherit');
    const color = chalk.binding('Color');
    expect(inherit.object.value).toBe(true);
    expect(color.object.value).toBe('#445566');
    expect(color.disabled).toBe(true);

    inherit.input(false);
    expect(wand.getConfig().chalk?.color).toBe('#445566');
    expect(color.disabled).toBe(false);

    color.input('#AABBCC');
    expect(wand.getConfig().chalk?.color).toBe('#aabbcc');

    inherit.input(true);
    expect(wand.getConfig().chalk?.color).toBeNull();
    expect(color.disabled).toBe(true);
  });

  it('writes binding changes to the wand and refreshes on config events', async () => {
    const { wand, plugin } = setup();
    await plugin.open();
    const pane = lastPane();
    const chalk = pane.folders[1];
    if (!chalk) throw new Error('The chalk folder is missing.');
    chalk.binding('Size').input(22);
    expect(wand.patches[wand.patches.length - 1]).toEqual({ chalk: { size: 22 } });

    const refreshes = pane.refreshes;
    const patches = wand.patches.length;
    wand.replaceConfig({ ...wand.getConfig(), chalk: { enabled: false, size: 9, color: null } });
    expect(pane.refreshes).toBe(refreshes + 1);
    expect(chalk.binding('Size').object.value).toBe(9);
    expect(chalk.binding('Enabled').object.value).toBe(false);
    expect(wand.patches.length).toBe(patches);
  });

  it('resets, exports and imports with the buttons', async () => {
    const { wand, plugin } = setup();
    await plugin.open();
    const pane = lastPane();
    pane.buttons.get('Reset')?.click();
    expect(wand.resets).toBe(1);

    const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:config');
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    pane.buttons.get('Export')?.click();
    expect(createUrl).toHaveBeenCalledTimes(1);
    const blob = createUrl.mock.calls[0]?.[0] as Blob;
    expect(JSON.parse(await blob.text())).toMatchObject({ v: 1, chalk: { size: 15 } });
    expect(click).toHaveBeenCalledTimes(1);

    const input = box()?.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error('The file input is missing.');
    const inputClick = vi.spyOn(input, 'click').mockImplementation(() => {});
    pane.buttons.get('Import')?.click();
    expect(inputClick).toHaveBeenCalledTimes(1);

    const transfer = new DataTransfer();
    transfer.items.add(new File(['{"v":1,"chalk":{"size":33}}'], 'wand.json'));
    input.files = transfer.files;
    input.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(wand.imported).toEqual([{ v: 1, chalk: { size: 33 } }]));

    const broken = new DataTransfer();
    broken.items.add(new File(['{bad'], 'broken.json'));
    input.files = broken.files;
    input.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(reported).toHaveLength(1));
    expect(String(reported[0])).toContain(
      'The file "broken.json" does not contain JSON that is valid.',
    );
    expect(wand.imported).toHaveLength(1);

    pane.buttons.get('Close')?.click();
    expect(plugin.isOpen).toBe(false);
  });

  it('toggles the panel with the hotkey', async () => {
    const { plugin } = setup({ hotkey: 'Alt+Shift+W' });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'W', code: 'KeyW', shiftKey: true }));
    expect(plugin.isOpen).toBe(false);
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'W', code: 'KeyW', shiftKey: true, altKey: true }),
    );
    await vi.waitFor(() => expect(box()?.style.display).toBe('block'));
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'W', code: 'KeyW', shiftKey: true, altKey: true }),
    );
    expect(plugin.isOpen).toBe(false);
  });

  it('opens at start when the URL has the parameter', async () => {
    const url = new URL(window.location.href);
    url.searchParams.set('wand-panel', '');
    const previous = window.location.href;
    window.history.replaceState(null, '', url);
    try {
      const { load, plugin } = setup({ urlParam: 'wand-panel' });
      expect(plugin.isOpen).toBe(true);
      await vi.waitFor(() => expect(box()?.style.display).toBe('block'));
      expect(load).toHaveBeenCalledTimes(1);
    } finally {
      window.history.replaceState(null, '', previous);
    }
  });

  it('keeps the triggers off by default', () => {
    const { load, plugin } = setup({ urlParam: 'not-in-the-url' });
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'W', code: 'KeyW', shiftKey: true, altKey: true }),
    );
    expect(document.querySelector('button[data-wand-ui]')).toBeNull();
    expect(plugin.isOpen).toBe(false);
    expect(load).not.toHaveBeenCalled();
  });

  it('shows a launcher button that opens the panel', async () => {
    const { plugin } = setup({ launcher: true });
    const launcher = document.querySelector<HTMLButtonElement>('button[data-wand-ui]');
    if (!launcher) throw new Error('The launcher is missing.');
    expect(launcher.style.position).toBe('fixed');
    launcher.click();
    await vi.waitFor(() => expect(plugin.isOpen && box()?.style.display === 'block').toBe(true));
    expect(launcher.style.display).toBe('none');
    plugin.close();
    expect(launcher.style.display).toBe('block');
  });

  it('renders in the given container', async () => {
    const container = document.createElement('section');
    document.body.appendChild(container);
    const { plugin } = setup({ container });
    await plugin.open();
    expect(container.contains(lastPane().element)).toBe(true);
  });

  it('stays closed, reports the error and allows a retry when the loader fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const offline = new Error('offline');
    const load = vi
      .fn<() => Promise<TweakpaneModule>>()
      .mockRejectedValueOnce(offline)
      .mockResolvedValue(fakeTweakpane);
    const { plugin } = setup({ load });
    await plugin.open();
    expect(plugin.isOpen).toBe(false);
    expect(reported).toEqual([offline]);
    expect(warn).not.toHaveBeenCalled();
    await plugin.open();
    expect(plugin.isOpen).toBe(true);
  });

  it('removes all DOM and listeners on destroy', async () => {
    const { wand, plugin } = setup({ launcher: true, hotkey: 'Alt+W' });
    await plugin.open();
    const pane = lastPane();
    plugin.destroy?.();
    expect(pane.disposed).toBe(true);
    expect(document.querySelector('[data-wand-ui]')).toBeNull();
    expect(wand.listenerCount).toBe(0);
    expect(plugin.isOpen).toBe(false);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', code: 'KeyW', altKey: true }));
    expect(plugin.isOpen).toBe(false);
  });
});

describe('panelPlugin with the real Tweakpane package', () => {
  it('renders the pane and adds the nonce to the Tweakpane style element', async () => {
    const { plugin } = setup({
      load: async () => tweakpanePackage,
      nonce: 'abc123',
    });
    await plugin.open();
    const root = box()?.querySelector('.tp-rotv');
    expect(root).not.toBeNull();
    expect(box()?.textContent).toContain('Chalk');
    const style = document.querySelector<HTMLStyleElement>('style[data-tp-style]');
    expect(style?.nonce).toBe('abc123');
    expect(style?.textContent?.length).toBeGreaterThan(0);
    plugin.destroy?.();
    expect(document.querySelector('.tp-rotv')).toBeNull();
  });

  it('applies the Tweakpane styles under a strict Content Security Policy only with the nonce', async () => {
    const fontSize = async (nonce: string | undefined): Promise<string> => {
      const frame = document.createElement('iframe');
      frame.srcdoc = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="style-src 'nonce-abc123'"></head><body></body></html>`;
      const loaded = new Promise((resolve) =>
        frame.addEventListener('load', resolve, { once: true }),
      );
      document.body.appendChild(frame);
      await loaded;
      const body = frame.contentDocument?.body;
      if (!body) throw new Error('The frame has no body.');
      const { plugin } = setup(
        { load: async () => tweakpanePackage, ...(nonce ? { nonce } : {}) },
        body,
      );
      await plugin.open();
      const root = body.querySelector('.tp-rotv');
      if (!root) throw new Error('The pane is missing.');
      const size = frame.contentWindow?.getComputedStyle(root).fontSize ?? '';
      plugin.destroy?.();
      frame.remove();
      return size;
    };
    expect(await fontSize(undefined)).not.toBe('11px');
    expect(await fontSize('abc123')).toBe('11px');
  });
});
