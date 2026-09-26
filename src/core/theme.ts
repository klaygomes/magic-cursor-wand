import { field } from '../config/field';
import type { ColorField, EnumField, Motion, NumberField, Section } from '../config/types';

/** The schema of the `theme` section that the core owns. */
export interface ThemeSchema {
  readonly [key: string]: ColorField<false> | EnumField<Motion> | NumberField;
  readonly color: ColorField<false>;
  readonly motion: EnumField<Motion>;
  readonly maxDpr: NumberField;
}

/**
 * Creates the `theme` section. The effects get its color when their own color is `null`.
 *
 * @returns The section.
 */
export function themeSection(): Section<'theme', ThemeSchema> {
  return {
    name: 'theme',
    schema: {
      color: field.color({
        label: 'Color',
        description: 'The color of the effects that inherit the theme color.',
        default: '#ffffff',
      }),
      motion: field.enum<Motion>({
        label: 'Motion',
        description: 'The motion level. The value "auto" follows the system setting.',
        default: 'auto',
        options: ['auto', 'full', 'reduced', 'off'],
      }),
      maxDpr: field.number({
        label: 'Maximum pixel ratio',
        description: 'The highest device pixel ratio of the canvas.',
        default: 2,
        min: 1,
        max: 3,
        step: 0.5,
      }),
    },
  };
}
