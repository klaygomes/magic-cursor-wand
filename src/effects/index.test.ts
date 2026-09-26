import { describe, expectTypeOf, it } from 'vitest';
import type { ComposeConfig } from '../config/types';
import type { AnySection, Effect, EffectConfig } from '../core/types';
import { chalkEffect, cloudEffect, type GlitterSchema, glitterEffect } from './index';

type Config = ComposeConfig<
  [ReturnType<typeof cloudEffect>, ReturnType<typeof chalkEffect>, ReturnType<typeof glitterEffect>]
>;

describe('effect types', () => {
  it('fits the generic effect contract', () => {
    expectTypeOf(cloudEffect()).toExtend<Effect>();
    expectTypeOf(chalkEffect()).toExtend<AnySection>();
    expectTypeOf(glitterEffect()).toExtend<Effect>();
  });

  it('infers the field types of each section', () => {
    expectTypeOf<Config['cloud']['maxClouds']>().toEqualTypeOf<number>();
    expectTypeOf<Config['chalk']['color']>().toEqualTypeOf<string | null>();
    expectTypeOf<Config['glitter']['enabled']>().toEqualTypeOf<boolean>();
    expectTypeOf<EffectConfig<GlitterSchema>['color']>().toEqualTypeOf<string>();
  });
});
