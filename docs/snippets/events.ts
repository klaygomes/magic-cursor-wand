// #region lifecycle
import { createWand } from 'magic-cursor-wand';

const wand = createWand({ silent: true });

const stop = wand.on('error', (error) => {
  reportToMonitor(`${error.kind} ${error.source}: ${error.message}`);
});
// #endregion lifecycle

// #region config
wand.on('config', ({ next, previous }) => {
  if (next.theme.motion !== previous.theme.motion) reportToMonitor(next.theme.motion);
});
// #endregion config

stop();

function reportToMonitor(message: string): void {
  navigator.sendBeacon('/api/log', message);
}
