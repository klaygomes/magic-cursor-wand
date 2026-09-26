import { createWand } from 'magic-cursor-wand';
import { cursorPlugin } from 'magic-cursor-wand/cursor';
import { localStorageProvider } from 'magic-cursor-wand/providers';
import { autoplayStroke } from './autoplay';
import { bindCopyButtons } from './copy';
import { dockedPanel } from './panel';
import { revealOnScroll } from './reveal';

const panel = dockedPanel();

createWand({
  plugins: [cursorPlugin({ mode: 'replace' }), panel],
  providers: [localStorageProvider({ key: 'magic-cursor-wand-demo-v3' })],
});

void panel.open();
revealOnScroll();
bindCopyButtons();

const slate = document.querySelector('[data-slate]');
if (slate) autoplayStroke(slate);
