import { type PanelPlugin, panelPlugin } from 'magic-cursor-wand/panel';

export const hasHoverPointer: boolean = matchMedia('(any-hover: hover)').matches;

export function dockedPanel(): PanelPlugin {
  const container = document.querySelector<HTMLElement>('#settings');
  return panelPlugin({
    title: 'Wand settings',
    closable: false,
    expanded: ['theme', 'chalk', 'glitter', 'cloud', ...(hasHoverPointer ? ['cursor'] : [])],
    ...(container ? { container } : {}),
  });
}
