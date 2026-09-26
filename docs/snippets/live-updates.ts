// #region sse
import { createWand } from 'magic-cursor-wand';
import { eventSourceProvider } from 'magic-cursor-wand/providers';

createWand({
  providers: [eventSourceProvider({ url: '/api/wand/stream', withCredentials: true })],
});
// #endregion sse
