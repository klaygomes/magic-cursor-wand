import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.browser.test.ts', 'src/**/*.browser.test.tsx'],
          environment: 'node',
        },
      },
      {
        optimizeDeps: {
          include: [
            'react',
            'react-dom',
            'react-dom/client',
            '@testing-library/react',
            'tweakpane',
          ],
        },
        test: {
          name: 'browser',
          include: [
            'src/**/*.browser.test.ts',
            'src/**/*.browser.test.tsx',
            'test/**/*.browser.test.ts',
          ],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }, { browser: 'firefox' }, { browser: 'webkit' }],
          },
        },
      },
    ],
  },
});
