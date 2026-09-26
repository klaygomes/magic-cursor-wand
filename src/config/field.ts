import type { BooleanField, ColorField, EnumField, FieldMeta, NumberField } from './types';

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

interface NumberOptions extends FieldMeta {
  readonly default: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

interface ColorOptions<Nullable extends boolean> extends FieldMeta {
  readonly default: Nullable extends true ? string | null : string;
  readonly nullable?: Nullable;
}

interface BooleanOptions extends FieldMeta {
  readonly default: boolean;
}

interface EnumOptions<V extends string> extends FieldMeta {
  readonly default: V;
  readonly options: readonly V[];
}

function decimalsOf(step: number): number {
  const [, fraction = ''] = String(step).split('.');
  return fraction.length;
}

function numberField(options: NumberOptions): NumberField {
  const decimals = decimalsOf(options.step);
  return {
    ...options,
    kind: 'number',
    parse(input) {
      const value = typeof input === 'string' && input.trim() !== '' ? Number(input) : input;
      if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
      const clamped = Math.min(options.max, Math.max(options.min, value));
      const snapped =
        options.min + Math.round((clamped - options.min) / options.step) * options.step;
      return Number(Math.min(options.max, snapped).toFixed(decimals));
    },
  };
}

function colorField<Nullable extends boolean = false>(
  options: ColorOptions<Nullable>,
): ColorField<Nullable> {
  const nullable = (options.nullable ?? false) as Nullable;
  return {
    ...options,
    kind: 'color',
    nullable,
    parse(input) {
      if (input === null && nullable) return null as ColorField<Nullable>['default'];
      if (typeof input !== 'string' || !HEX_COLOR.test(input)) return undefined;
      return input.toLowerCase();
    },
  };
}

function booleanField(options: BooleanOptions): BooleanField {
  return {
    ...options,
    kind: 'boolean',
    parse: (input) => (typeof input === 'boolean' ? input : undefined),
  };
}

function enumField<const V extends string>(options: EnumOptions<V>): EnumField<V> {
  return {
    ...options,
    kind: 'enum',
    parse: (input) => options.options.find((option) => option === input),
  };
}

/**
 * Builders for the fields of a configuration schema.
 *
 * @example
 * const schema = { size: field.number({ label: 'Size', description: 'The width of the stroke.', default: 15, min: 1, max: 50, step: 1 }) };
 */
export const field: {
  number: typeof numberField;
  color: typeof colorField;
  boolean: typeof booleanField;
  enum: typeof enumField;
} = {
  number: numberField,
  color: colorField,
  boolean: booleanField,
  enum: enumField,
};
