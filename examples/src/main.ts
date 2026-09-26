import { createWand } from 'magic-cursor-wand';
import { cursorPlugin } from 'magic-cursor-wand/cursor';
import { panelPlugin } from 'magic-cursor-wand/panel';
import { localStorageProvider } from 'magic-cursor-wand/providers';
import { autoplayStroke } from './autoplay';
import { bindCopyButtons } from './copy';
import { palette } from './palette';
import { revealOnScroll } from './reveal';

const panel = panelPlugin({
  hotkey: 'Alt+Shift+W',
  urlParam: 'panel',
  title: 'Wand settings',
  expanded: ['theme', 'chalk', 'glitter', 'cloud', 'cursor'],
});

createWand({
  plugins: [cursorPlugin({ mode: 'replace' }), panel],
  providers: [localStorageProvider({ key: 'magic-cursor-wand-demo-v2' })],
  config: palette,
});

revealOnScroll();
bindCopyButtons();

for (const button of document.querySelectorAll('[data-open-panel]')) {
  button.addEventListener('click', () => panel.toggle());
}

const slate = document.querySelector('[data-slate]');
if (slate) autoplayStroke(slate);
