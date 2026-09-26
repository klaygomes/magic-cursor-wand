// #region nonce
import { createWand } from 'magic-cursor-wand';
import { panelPlugin } from 'magic-cursor-wand/panel';

const nonce = document.querySelector<HTMLMetaElement>('meta[name="csp-nonce"]')?.content ?? '';

createWand({ plugins: [panelPlugin({ nonce })] });
// #endregion nonce
