// #region http
import { createWand } from 'magic-cursor-wand';
import { httpProvider, localStorageProvider } from 'magic-cursor-wand/providers';

const wand = createWand({
  providers: [
    httpProvider({
      url: '/api/wand.json',
      headers: { Accept: 'application/json' },
      pollMs: 60_000,
    }),
    localStorageProvider({ key: 'my-site-wand' }),
  ],
  startAfter: 'ready',
});
// #endregion http

// #region ready
await wand.ready;
// #endregion ready
