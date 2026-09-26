import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const source = (path: string): string => fileURLToPath(new URL(`../src/${path}`, import.meta.url));

export default defineConfig({
  publicDir: fileURLToPath(new URL('../dist', import.meta.url)),
  resolve: {
    alias: [
      { find: /^magic-cursor-wand$/, replacement: source('index.ts') },
      { find: /^magic-cursor-wand\/(providers|cursor|panel)$/, replacement: source('$1/index.ts') },
    ],
  },
  build: {
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL('index.html', import.meta.url)),
        container: fileURLToPath(new URL('container.html', import.meta.url)),
        scriptTag: fileURLToPath(new URL('script-tag.html', import.meta.url)),
      },
    },
  },
});
