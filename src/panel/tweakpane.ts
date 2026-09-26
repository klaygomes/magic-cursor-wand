/** The URL of the Tweakpane 4 ES module on the jsDelivr CDN. The script tag build loads Tweakpane from this URL. */
export const TWEAKPANE_CDN_URL =
  'https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js';

/** The part of a Tweakpane binding that the panel uses. */
export interface TweakpaneBinding {
  disabled: boolean;
  on(event: 'change', handler: (event: { readonly value: unknown }) => void): unknown;
}

/** The part of a Tweakpane button that the panel uses. */
export interface TweakpaneButton {
  on(event: 'click', handler: () => void): unknown;
}

/** The part of a Tweakpane folder that the panel uses. */
export interface TweakpaneContainer {
  addFolder(params: { title: string; expanded?: boolean }): TweakpaneContainer;
  addBinding(
    object: Record<string, unknown>,
    key: string,
    params?: Record<string, unknown>,
  ): TweakpaneBinding;
  addButton(params: { title: string }): TweakpaneButton;
}

/** The part of a Tweakpane pane that the panel uses. */
export interface TweakpanePane extends TweakpaneContainer {
  readonly element: HTMLElement;
  refresh(): void;
  dispose(): void;
}

/** The part of the Tweakpane module that the panel uses. */
export interface TweakpaneModule {
  readonly Pane: new (config: {
    container?: HTMLElement;
    document?: Document;
    title?: string;
    expanded?: boolean;
  }) => TweakpanePane;
}

/** A function that loads the Tweakpane module. */
export type TweakpaneLoader = () => Promise<TweakpaneModule>;

/**
 * Load Tweakpane from the `tweakpane` package.
 *
 * @returns The Tweakpane module.
 */
export const loadTweakpanePackage: TweakpaneLoader = () => import('tweakpane');

/**
 * Add a nonce to the style elements of Tweakpane, then apply their rules again.
 *
 * Tweakpane 4 has no nonce option. A strict Content Security Policy blocks a style element without a nonce.
 * The text write makes the browser check the style element again with the nonce.
 *
 * @param doc - The document that contains the style elements.
 * @param nonce - The nonce of the Content Security Policy.
 */
export function applyStyleNonce(doc: Document, nonce: string): void {
  for (const style of Array.from(doc.querySelectorAll<HTMLStyleElement>('style[data-tp-style]'))) {
    if (style.nonce === nonce) continue;
    style.setAttribute('nonce', nonce);
    style.nonce = nonce;
    const text = style.textContent;
    style.textContent = '';
    style.textContent = text;
  }
}
