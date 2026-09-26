import { existsSync, readFileSync } from 'node:fs';
import { type DefaultTheme, defineConfig } from 'vitepress';

const apiSidebarFile = new URL('../reference/api/typedoc-sidebar.json', import.meta.url);

function apiSidebar(): DefaultTheme.SidebarItem[] {
  if (!existsSync(apiSidebarFile)) {
    return [{ text: 'Run pnpm docs:api to make this part', link: '/reference/' }];
  }
  return JSON.parse(readFileSync(apiSidebarFile, 'utf8')) as DefaultTheme.SidebarItem[];
}

const guide: DefaultTheme.SidebarItem[] = [
  { text: 'Get started', items: [{ text: 'Install and start', link: '/guide/getting-started' }] },
  {
    text: 'Concepts',
    items: [
      { text: 'Surface', link: '/concepts/surface' },
      { text: 'Configuration', link: '/concepts/configuration' },
      { text: 'Providers', link: '/concepts/providers' },
      { text: 'Effects', link: '/concepts/effects' },
      { text: 'Events', link: '/concepts/events' },
      { text: 'Plugins', link: '/concepts/plugins' },
    ],
  },
  {
    text: 'How-to',
    items: [
      { text: 'Use a script tag', link: '/how-to/use-script-tag' },
      { text: 'Use React', link: '/how-to/use-react' },
      { text: 'Keep settings in the browser', link: '/how-to/add-local-storage' },
      { text: 'Load a remote configuration', link: '/how-to/load-remote-config' },
      { text: 'Get live updates', link: '/how-to/live-updates-sse' },
      { text: 'Lock a value', link: '/how-to/lock-a-value' },
      { text: 'Write an effect', link: '/how-to/write-an-effect' },
      { text: 'Write a provider', link: '/how-to/write-a-provider' },
      { text: 'Obey a strict CSP', link: '/how-to/strict-csp' },
      { text: 'Decrease the motion', link: '/how-to/reduced-motion' },
      { text: 'Open the settings panel', link: '/how-to/open-the-panel' },
      { text: 'Use light backgrounds', link: '/how-to/light-backgrounds' },
    ],
  },
  {
    text: 'Reference',
    items: [
      { text: 'Overview', link: '/reference/' },
      { text: 'Configuration', link: '/reference/configuration' },
      { text: 'API', link: '/reference/api/' },
    ],
  },
  {
    text: 'Troubleshooting',
    items: [{ text: 'Problems and solutions', link: '/troubleshooting' }],
  },
];

export default defineConfig({
  title: 'magic-cursor-wand',
  description: 'Chalk, glitter and cloud effects that follow the pointer.',
  base: '/magic-cursor-wand/',
  lang: 'en-US',
  head: [['meta', { name: 'theme-color', content: '#480f7b' }]],
  cleanUrls: true,
  srcExclude: ['**/*.generated.md'],
  lastUpdated: true,
  ignoreDeadLinks: [/^\/reference\/api\//],
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'How-to', link: '/how-to/use-script-tag' },
      { text: 'Reference', link: '/reference/' },
      {
        text: 'Demo',
        link: 'https://www.estacouveflor.com/magic-cursor-wand/examples/',
        target: '_self',
      },
    ],
    sidebar: {
      '/reference/api/': [{ text: 'API', items: apiSidebar() }],
      '/': guide,
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/klaygomes/magic-cursor-wand' }],
    search: { provider: 'local' },
    editLink: {
      pattern: 'https://github.com/klaygomes/magic-cursor-wand/edit/main/docs/:path',
    },
  },
});
