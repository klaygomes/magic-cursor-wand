// #region plugin
import { createWand } from 'magic-cursor-wand';
import { panelPlugin } from 'magic-cursor-wand/panel';

const panel = panelPlugin({ hotkey: 'Alt+W', urlParam: 'wand' });

createWand({ plugins: [panel] });
// #endregion plugin

// #region button
document.querySelector('#wand-settings')?.addEventListener('click', () => panel.toggle());
// #endregion button
