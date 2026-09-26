import { describe, expectTypeOf, it } from 'vitest';
import type { NumberField, Section } from '../config/types';
import type { AnySection, Effect } from './types';

type ChalkEffect = Effect<'chalk', { size: NumberField }>;

describe('contracts', () => {
  it('accepts a concrete effect where any section is expected', () => {
    expectTypeOf<ChalkEffect>().toExtend<AnySection>();
    expectTypeOf<ChalkEffect>().toExtend<Section>();
  });
});
