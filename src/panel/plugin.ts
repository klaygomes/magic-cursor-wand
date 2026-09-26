import type { Plugin, PluginContext } from '../core/types';
import { type Hotkey, matchesHotkey, parseHotkey } from './hotkey';
import { type PanelModel, panelModel } from './model';
import { downloadJson, type RenderedPane, renderPane } from './render';
import {
  applyStyleNonce,
  loadTweakpanePackage,
  type TweakpaneLoader,
  type TweakpaneModule,
} from './tweakpane';

const DEFAULT_TITLE = 'Magic cursor wand';
const TOP_Z_INDEX = '2147483647';

/** The schema of the panel section. The panel has no fields. */
export type PanelSchema = Record<never, never>;

/** The options of the settings panel plugin. */
export interface PanelPluginOptions {
  /** The function that loads Tweakpane 4. The default imports the `tweakpane` package. */
  readonly load?: TweakpaneLoader;
  /** The keyboard shortcut that opens and closes the panel, for example `Alt+Shift+W`. */
  readonly hotkey?: string;
  /** The panel opens at start if the page URL has this query parameter. */
  readonly urlParam?: string;
  /** Set to true to show a button that opens the panel. */
  readonly launcher?: boolean;
  /** The nonce of the Content Security Policy for the style elements of Tweakpane. */
  readonly nonce?: string;
  /** The element that contains the panel. The default is a fixed box on the right side of the page. */
  readonly container?: HTMLElement;
  /** The title of the panel. */
  readonly title?: string;
}

/** The settings panel plugin. The plugin instance opens and closes the panel. */
export interface PanelPlugin extends Plugin<'panel', PanelSchema> {
  /** True while the panel is open. */
  readonly isOpen: boolean;
  /** Load Tweakpane if necessary, then show the panel. */
  open(): Promise<void>;
  /** Hide the panel. */
  close(): void;
  /** Close the panel if it is open. Otherwise, open the panel. */
  toggle(): Promise<void>;
}

interface Mounted {
  readonly doc: Document;
  readonly model: PanelModel;
  readonly box: HTMLDivElement;
  readonly fileInput: HTMLInputElement;
  readonly launcher: HTMLButtonElement | undefined;
  readonly cleanups: (() => void)[];
  pane: RenderedPane | undefined;
  loading: Promise<TweakpaneModule> | undefined;
}

function stopPropagation(event: Event): void {
  event.stopPropagation();
}

function createBox(doc: Document, container: HTMLElement | undefined): HTMLDivElement {
  const box = doc.createElement('div');
  box.setAttribute('data-wand-ui', '');
  box.style.display = 'none';
  if (!container) {
    box.style.position = 'fixed';
    box.style.top = '16px';
    box.style.right = '16px';
    box.style.width = '280px';
    box.style.maxWidth = 'calc(100vw - 32px)';
    box.style.maxHeight = 'calc(100vh - 32px)';
    box.style.overflowY = 'auto';
    box.style.zIndex = TOP_Z_INDEX;
  }
  box.addEventListener('pointerdown', stopPropagation);
  return box;
}

function createFileInput(doc: Document): HTMLInputElement {
  const input = doc.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.style.display = 'none';
  return input;
}

function createLauncher(doc: Document): HTMLButtonElement {
  const button = doc.createElement('button');
  button.type = 'button';
  button.textContent = '⚙';
  button.title = 'Settings';
  button.setAttribute('aria-label', 'Open the settings');
  button.setAttribute('data-wand-ui', '');
  const style = button.style;
  style.position = 'fixed';
  style.top = '16px';
  style.right = '16px';
  style.zIndex = TOP_Z_INDEX;
  style.width = '36px';
  style.height = '36px';
  style.padding = '0';
  style.font = '20px/36px system-ui, sans-serif';
  style.color = '#ffffff';
  style.background = 'rgba(20, 20, 20, 0.85)';
  style.border = '1px solid rgba(255, 255, 255, 0.2)';
  style.borderRadius = '8px';
  style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.3)';
  style.cursor = 'pointer';
  button.addEventListener('pointerdown', stopPropagation);
  return button;
}

function warn(message: string, cause: unknown): void {
  console.warn(`magic-cursor-wand: ${message}`, cause);
}

/**
 * Create a plugin that shows a settings panel with Tweakpane 4. The plugin loads Tweakpane when the panel opens for the first time.
 *
 * @param options - The loader, the triggers, the nonce, the container and the title.
 * @returns The plugin with the name `panel`. Use `open()`, `close()` and `toggle()` to control the panel.
 * @example
 * const panel = panelPlugin({ hotkey: 'Alt+Shift+W', launcher: true });
 * createWand({ plugins: [panel] });
 * await panel.open();
 */
export function panelPlugin(options: PanelPluginOptions = {}): PanelPlugin {
  const load = options.load ?? loadTweakpanePackage;
  const title = options.title ?? DEFAULT_TITLE;
  let mounted: Mounted | undefined;
  let isOpen = false;

  const show = (state: Mounted, visible: boolean): void => {
    state.box.style.display = visible ? 'block' : 'none';
    if (state.launcher) state.launcher.style.display = visible ? 'none' : 'block';
  };

  const importFile = async (state: Mounted): Promise<void> => {
    const file = state.fileInput.files?.[0];
    state.fileInput.value = '';
    if (!file) return;
    try {
      state.model.importJson(await file.text());
    } catch (error) {
      warn('The panel cannot read the file.', error);
    }
  };

  const ensurePane = async (state: Mounted): Promise<RenderedPane> => {
    if (state.pane) return state.pane;
    if (!state.loading) state.loading = load();
    let tweakpane: TweakpaneModule;
    try {
      tweakpane = await state.loading;
    } catch (error) {
      state.loading = undefined;
      throw error;
    }
    if (state.pane) return state.pane;
    const pane = renderPane(tweakpane, state.box, state.model, title, {
      close: () => plugin.close(),
      importFile: () => state.fileInput.click(),
      exportFile: () => downloadJson(state.doc, state.model),
    });
    if (options.nonce) applyStyleNonce(state.doc, options.nonce);
    state.pane = pane;
    state.cleanups.push(state.model.subscribe(() => pane.sync()));
    return pane;
  };

  const plugin: PanelPlugin = {
    name: 'panel',
    schema: {},
    get isOpen() {
      return isOpen;
    },
    async open() {
      const state = mounted;
      if (!state || isOpen) return;
      isOpen = true;
      try {
        const pane = await ensurePane(state);
        if (mounted !== state || !isOpen) return;
        pane.sync();
        show(state, true);
      } catch (error) {
        if (mounted === state) isOpen = false;
        warn('The settings panel cannot load Tweakpane.', error);
      }
    },
    close() {
      isOpen = false;
      if (mounted) show(mounted, false);
    },
    toggle() {
      if (isOpen) {
        plugin.close();
        return Promise.resolve();
      }
      return plugin.open();
    },
    setup(context: PluginContext) {
      plugin.destroy?.();
      const doc = context.surface.element.ownerDocument;
      const view = doc.defaultView ?? window;
      const box = createBox(doc, options.container);
      const fileInput = createFileInput(doc);
      const launcher = options.launcher ? createLauncher(doc) : undefined;
      const state: Mounted = {
        doc,
        model: panelModel(context.wand),
        box,
        fileInput,
        launcher,
        cleanups: [],
        pane: undefined,
        loading: undefined,
      };
      mounted = state;

      box.appendChild(fileInput);
      (options.container ?? doc.body).appendChild(box);
      fileInput.addEventListener('change', () => void importFile(state));

      if (launcher) {
        launcher.addEventListener('click', () => void plugin.open());
        doc.body.appendChild(launcher);
      }

      const hotkey: Hotkey | undefined = options.hotkey ? parseHotkey(options.hotkey) : undefined;
      if (hotkey) {
        const onKeyDown = (event: KeyboardEvent): void => {
          if (event.repeat || !matchesHotkey(hotkey, event)) return;
          event.preventDefault();
          void plugin.toggle();
        };
        view.addEventListener('keydown', onKeyDown);
        state.cleanups.push(() => view.removeEventListener('keydown', onKeyDown));
      }

      if (options.urlParam && new URLSearchParams(view.location.search).has(options.urlParam)) {
        void plugin.open();
      }
    },
    destroy() {
      const state = mounted;
      mounted = undefined;
      isOpen = false;
      if (!state) return;
      for (const cleanup of state.cleanups) cleanup();
      state.pane?.dispose();
      state.box.remove();
      state.launcher?.remove();
    },
  };
  return plugin;
}
