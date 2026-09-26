import { createWand } from 'magic-cursor-wand';
import { palette } from './palette';

const target = document.querySelector<HTMLElement>('#board');
if (target) {
  createWand({ target, config: { ...palette, chalk: { size: 10 }, cloud: { enabled: false } } });
}
