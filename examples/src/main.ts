import { createWand } from 'magic-cursor-wand';
import { cursorPlugin } from 'magic-cursor-wand/cursor';
import { panelPlugin } from 'magic-cursor-wand/panel';
import { localStorageProvider } from 'magic-cursor-wand/providers';

createWand({
  plugins: [
    cursorPlugin({ mode: 'replace' }),
    panelPlugin({ launcher: true, hotkey: 'Alt+Shift+W', urlParam: 'panel' }),
  ],
  providers: [localStorageProvider({ key: 'magic-cursor-wand-demo' })],
});
