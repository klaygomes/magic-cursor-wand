import './fonts';
import './reveal';
import { createWand } from 'magic-cursor-wand';
import { autoplayStroke } from './autoplay';
import { palette } from './palette';

const target = document.querySelector<HTMLElement>('#board');
if (target) {
  createWand({ target, config: { ...palette, chalk: { size: 10 }, cloud: { enabled: false } } });
  autoplayStroke(target);
}
