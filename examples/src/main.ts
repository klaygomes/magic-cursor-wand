import './fonts';
import './reveal';
import './copy';
import { createWand } from 'magic-cursor-wand';
import { cursorPlugin } from 'magic-cursor-wand/cursor';
import { panelPlugin } from 'magic-cursor-wand/panel';
import { localStorageProvider } from 'magic-cursor-wand/providers';
import { autoplayStroke } from './autoplay';
import { palette } from './palette';

const panel = panelPlugin({ hotkey: 'Alt+Shift+W', urlParam: 'panel', title: 'Wand settings' });

createWand({
  plugins: [cursorPlugin({ mode: 'replace' }), panel],
  providers: [localStorageProvider({ key: 'magic-cursor-wand-demo-v2' })],
  config: palette,
});

for (const button of document.querySelectorAll('[data-open-panel]')) {
  button.addEventListener('click', () => panel.toggle());
}

const slate = document.querySelector('[data-slate]');
if (slate) autoplayStroke(slate);
