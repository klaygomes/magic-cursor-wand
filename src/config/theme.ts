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
      description: 'The color of each section that has no color of its own.',
      default: '#fad30b',
    }),
    motion: field.enum<Motion>({
      label: 'Motion',
      description:
        'The motion mode. The value "auto" follows the reduced motion option of the system.',
      default: 'full',
      options: ['auto', 'full', 'reduced', 'off'],
    }),
    maxDpr: field.number({
      label: 'Maximum pixel ratio',
      description: 'The maximum device pixel ratio of the canvas.',
      default: 1.5,
      min: 1,
      max: 3,
      step: 0.5,
    }),
  },
};
