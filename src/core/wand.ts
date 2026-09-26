import { createConfigStore } from '../config/store';
import type { ComposeConfig } from '../config/types';
import { chalkEffect, cloudEffect, glitterEffect } from '../effects';
import { createWandWith, type EngineOptions } from './engine';
import type { Effect, Plugin, Wand, WandOptions } from './types';

/** The types of the default effects: cloud, chalk and glitter. */
export type DefaultEffects = [
  ReturnType<typeof cloudEffect>,
  ReturnType<typeof chalkEffect>,
  ReturnType<typeof glitterEffect>,
];

/** The options of `createWand`, with the effect and plugin types for the configuration type. */
export type CreateWandOptions<
  E extends readonly Effect[],
  P extends readonly Plugin[],
> = WandOptions<[...E, ...P]> & { readonly effects?: E; readonly plugins?: P };

/**
 * Creates a wand and starts it.
 *
 * @param options - The effects, plugins, configuration, providers and target of the wand.
 * @returns The wand. Its configuration type comes from the effects and the plugins.
 * @throws If a different overlay wand exists.
 * @example
 * const wand = createWand({ config: { chalk: { size: 20 } } });
 * wand.destroy();
 */
export function createWand<
  const E extends readonly Effect[] = DefaultEffects,
  const P extends readonly Plugin[] = [],
>(options?: CreateWandOptions<E, P>): Wand<ComposeConfig<[...E, ...P]>> {
  return createWandWith(createConfigStore, (options ?? {}) as EngineOptions, () => [
    cloudEffect(),
    chalkEffect(),
    glitterEffect(),
  ]) as unknown as Wand<ComposeConfig<[...E, ...P]>>;
}
