import { createWand } from 'magic-cursor-wand';

const target = document.querySelector<HTMLElement>('#board');
if (target) createWand({ target, config: { chalk: { size: 10 }, cloud: { enabled: false } } });
