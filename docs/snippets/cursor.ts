// #region cursor
import { createWand } from 'magic-cursor-wand';
import { cursorPlugin } from 'magic-cursor-wand/cursor';

createWand({
  plugins: [cursorPlugin({ mode: 'replace' })],
});
// #endregion cursor
