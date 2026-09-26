import type { ConfigProvider } from './config/types';
import type { Plugin, Wand } from './core/types';
import { cursorPlugin } from './cursor';
import { createWand } from './index';
import {
  panelPlugin as createPanelPlugin,
  type PanelPlugin,
  type PanelPluginOptions,
  TWEAKPANE_CDN_URL,
  type TweakpaneModule,
} from './panel';
import { eventSourceProvider, httpProvider, localStorageProvider } from './providers';

export * from './cursor';
export * from './index';
export * from './panel';
export * from './providers';

const AUTO_START_KEYS = [
  'wandConfigUrl',
  'wandSseUrl',
  'wandStorageKey',
  'wandCursor',
  'wandPanelHotkey',
] as const;

function loadTweakpaneFromCdn(): Promise<TweakpaneModule> {
  return import(/* @vite-ignore */ TWEAKPANE_CDN_URL) as Promise<TweakpaneModule>;
}

/**
 * Create the settings panel plugin. The script tag build loads Tweakpane from the jsDelivr CDN.
 *
 * @param options - The loader, the triggers, the nonce, the container and the title.
 * @returns The plugin with the name `panel`.
 */
export function panelPlugin(options: PanelPluginOptions = {}): PanelPlugin {
  return createPanelPlugin({ load: loadTweakpaneFromCdn, ...options });
}

/**
 * Start a wand from the `data-wand-*` attributes of a script element.
 *
 * @param dataset - The data attributes of the script element.
 * @returns The wand, or `undefined` if the element has no `data-wand-*` attributes.
 */
export function startFromAttributes(dataset: DOMStringMap): Wand | undefined {
  if (!AUTO_START_KEYS.some((key) => dataset[key] !== undefined)) return undefined;

  const providers: ConfigProvider[] = [];
  if (dataset.wandConfigUrl) providers.push(httpProvider({ url: dataset.wandConfigUrl }));
  if (dataset.wandSseUrl) providers.push(eventSourceProvider({ url: dataset.wandSseUrl }));
  if (dataset.wandStorageKey) providers.push(localStorageProvider({ key: dataset.wandStorageKey }));

  const plugins: Plugin[] = [];
  if (dataset.wandCursor !== undefined) {
    plugins.push(cursorPlugin({ mode: dataset.wandCursor === 'replace' ? 'replace' : 'glow' }));
  }
  if (dataset.wandPanelHotkey) plugins.push(panelPlugin({ hotkey: dataset.wandPanelHotkey }));

  return createWand({ providers, plugins }) as unknown as Wand;
}

function autoStart(script: HTMLOrSVGScriptElement | null): void {
  if (!script) return;
  const { dataset } = script;
  if (!AUTO_START_KEYS.some((key) => dataset[key] !== undefined)) return;
  const start = (): void => {
    try {
      startFromAttributes(dataset);
    } catch (error) {
      console.warn('[magic-cursor-wand] The script element cannot start a wand.', error);
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}

autoStart(typeof document === 'undefined' ? null : document.currentScript);
