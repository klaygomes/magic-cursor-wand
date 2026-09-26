import type { ComposeConfig } from '../config/types';
import type { chalkEffect, cloudEffect, glitterEffect } from '../effects';
import type { Effect, Plugin, Wand, WandOptions } from './types';

export type DefaultEffects = [
  ReturnType<typeof cloudEffect>,
  ReturnType<typeof chalkEffect>,
  ReturnType<typeof glitterEffect>,
];

export type CreateWandOptions<
  E extends readonly Effect[],
  P extends readonly Plugin[],
> = WandOptions<[...E, ...P]> & { readonly effects?: E; readonly plugins?: P };

/**
 * Creates a wand and starts it.
 */
export function createWand<
  const E extends readonly Effect[] = DefaultEffects,
  const P extends readonly Plugin[] = [],
>(_options?: CreateWandOptions<E, P>): Wand<ComposeConfig<[...E, ...P]>> {
  throw new Error('The wand is not available. The engine agent replaces this stub.');
}
