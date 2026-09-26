import { defineConfig, type UserConfig } from 'tsdown';

const browser: UserConfig = {
  platform: 'browser',
  target: ['es2020', 'chrome88', 'firefox85', 'safari14.1'],
  sourcemap: true,
};

export default defineConfig([
  {
    ...browser,
    entry: {
      index: 'src/index.ts',
      providers: 'src/providers/index.ts',
      cursor: 'src/cursor/index.ts',
      panel: 'src/panel/index.ts',
      react: 'src/react/index.ts',
    },
    format: 'esm',
    dts: true,
    external: ['react', 'react/jsx-runtime', 'tweakpane'],
    attw: { profile: 'esm-only' },
  },
  {
    ...browser,
    entry: { 'magic-cursor-wand': 'src/iife.ts' },
    format: 'iife',
    globalName: 'MagicCursorWand',
    minify: true,
  },
]);
