// #region local
import { createWand } from 'magic-cursor-wand';
import { localStorageProvider } from 'magic-cursor-wand/providers';

const wand = createWand({
  providers: [localStorageProvider({ key: 'my-site-wand' })],
});
// #endregion local

// #region save
await wand.save({ to: 'local' });
// #endregion save
