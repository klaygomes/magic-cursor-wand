import { createWand } from 'magic-cursor-wand';
import { autoplayStroke } from './autoplay';
import { dockedPanel } from './panel';
import { revealOnScroll } from './reveal';

revealOnScroll();

const target = document.querySelector<HTMLElement>('#board');
if (target) {
  const panel = dockedPanel();
  createWand({ target, plugins: [panel] });
  void panel.open();
  autoplayStroke(target);
}
