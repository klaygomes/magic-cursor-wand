import { field } from './field';
import type { ColorField, EnumField, Motion, NumberField, Section } from './types';

/**
 * The schema of the core `theme` section.
 */
export type ThemeSchema = {
  readonly color: ColorField<false>;
  readonly motion: EnumField<Motion>;
  readonly maxDpr: NumberField;
};

/**
 * The core section that holds the shared color, the motion mode and the pixel ratio limit.
 *
 * @example
 * const store = createConfigStore({ sections: [theme, chalkEffect()] });
 */
export const theme: Section<'theme', ThemeSchema> = {
  name: 'theme',
  schema: {
    color: field.color({
      label: 'Color',
      description: 'The color that each section uses when its own color is not set.',
      default: '#ffffff',
    }),
    motion: field.enum<Motion>({
      label: 'Motion',
      description:
        'The motion mode. The value "auto" follows the reduced motion setting of the system.',
      default: 'auto',
      options: ['auto', 'full', 'reduced', 'off'],
    }),
    maxDpr: field.number({
      label: 'Maximum pixel ratio',
      description: 'The maximum device pixel ratio of the canvas.',
      default: 2,
      min: 1,
      max: 3,
      step: 0.5,
    }),
  },
};
