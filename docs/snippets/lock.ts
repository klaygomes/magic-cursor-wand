// #region lock
import { createWand } from 'magic-cursor-wand';
import { localStorageProvider } from 'magic-cursor-wand/providers';

createWand({
  config: { glitter: { maxParticles: 200 }, theme: { maxDpr: 1.5 } },
  providers: [localStorageProvider({ key: 'my-site-wand' })],
  locked: ['glitter.maxParticles', 'theme.maxDpr'],
});
// #endregion lock
