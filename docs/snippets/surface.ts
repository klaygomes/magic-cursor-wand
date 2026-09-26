// #region container
import { createWand } from 'magic-cursor-wand';

const target = document.querySelector<HTMLElement>('#hero');

if (target) {
  createWand({ target, touchAction: 'pan-y', zIndex: 1 });
}
// #endregion container
