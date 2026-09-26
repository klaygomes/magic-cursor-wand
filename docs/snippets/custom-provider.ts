// #region provider
import { type ConfigDocument, type ConfigProvider, createWand } from 'magic-cursor-wand';

export function sessionStorageProvider(key: string): ConfigProvider {
  return {
    name: 'session',
    async load() {
      try {
        const raw = sessionStorage.getItem(key);
        return raw ? (JSON.parse(raw) as ConfigDocument) : null;
      } catch {
        return null;
      }
    },
    async save(document) {
      try {
        sessionStorage.setItem(key, JSON.stringify(document));
      } catch {
        return;
      }
    },
  };
}
// #endregion provider

// #region register
createWand({ providers: [sessionStorageProvider('my-site-wand')] });
// #endregion register
