import { createWand, type Plugin } from 'magic-cursor-wand';

// #region augment
declare module 'magic-cursor-wand' {
  interface WandEvents {
    milestone: { bursts: number };
  }
}
// #endregion augment

// #region plugin
const schema = {};

export function burstCounterPlugin(output: HTMLElement): Plugin<'burstCounter', typeof schema> {
  const stops: Array<() => void> = [];
  let bursts = 0;

  return {
    name: 'burstCounter',
    schema,
    setup({ bus }) {
      stops.push(
        bus.on('burst', () => {
          bursts += 1;
          output.textContent = String(bursts);
          if (bursts % 100 === 0) bus.emit('milestone', { bursts });
        }),
      );
    },
    destroy() {
      for (const stop of stops) stop();
    },
  };
}
// #endregion plugin

// #region register
const output = document.querySelector<HTMLElement>('#bursts');

if (output) {
  createWand({ plugins: [burstCounterPlugin(output)] });
}
// #endregion register
