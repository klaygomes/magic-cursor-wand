import type { Effect } from '../core/types';

function pending(name: string): never {
  throw new Error(`The effect "${name}" is not available. The effects agent replaces this stub.`);
}

/** Creates the cloud effect. */
export function cloudEffect(): Effect<'cloud'> {
  return pending('cloud');
}

/** Creates the chalk effect. */
export function chalkEffect(): Effect<'chalk'> {
  return pending('chalk');
}

/** Creates the glitter effect. */
export function glitterEffect(_options?: { sprite?: CanvasImageSource }): Effect<'glitter'> {
  return pending('glitter');
}
