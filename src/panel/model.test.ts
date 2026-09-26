import { describe, expect, it, vi } from 'vitest';
import { field } from '../config/field';
import type { Section } from '../config/types';
import { createFakeWand, type FakeConfig } from './fake_wand';
import { type ColorControl, type NumberControl, panelModel } from './model';

const theme: Section = {
  name: 'theme',
  schema: {
    color: field.color({ label: 'Color', description: 'The theme color.', default: '#ffffff' }),
    motion: field.enum({
      label: 'Motion',
      description: 'The motion level.',
      default: 'auto',
      options: ['auto', 'full', 'reduced', 'off'],
    }),
  },
};

const chalk: Section = {
  name: 'chalk',
  schema: {
    size: field.number({
      label: 'Size',
      description: 'The stroke width.',
      default: 15,
      min: 1,
      max: 50,
      step: 1,
    }),
    color: field.color({
      label: 'Color',
      description: 'The chalk color.',
      default: null,
      nullable: true,
    }),
  },
};

const panel: Section = { name: 'panel', schema: {} };

const initial: FakeConfig = {
  theme: { color: '#112233', motion: 'auto' },
  chalk: { enabled: true, size: 15, color: null },
  panel: { enabled: true },
};

function setup(sections: readonly Section[] = [chalk, theme, panel]) {
  const wand = createFakeWand(sections, initial);
  return { wand, model: panelModel(wand) };
}

describe('panelModel', () => {
  it('puts the theme group first and skips sections without fields', () => {
    const { model } = setup();
    expect(model.groups.map((group) => group.name)).toEqual(['theme', 'chalk']);
    expect(model.groups.map((group) => group.title)).toEqual(['Theme', 'Chalk']);
  });

  it('derives the controls from the field metadata and the current values', () => {
    const { model } = setup();
    const [themeGroup, chalkGroup] = model.groups;
    expect(themeGroup?.controls.map((control) => control.key)).toEqual(['color', 'motion']);
    expect(themeGroup?.controls[1]).toMatchObject({
      kind: 'enum',
      path: 'theme.motion',
      options: ['auto', 'full', 'reduced', 'off'],
      value: 'auto',
    });
    expect(chalkGroup?.controls.map((control) => control.path)).toEqual([
      'chalk.enabled',
      'chalk.size',
      'chalk.color',
    ]);
    const size = chalkGroup?.controls[1] as NumberControl;
    expect(size).toMatchObject({
      kind: 'number',
      label: 'Size',
      description: 'The stroke width.',
      min: 1,
      max: 50,
      step: 1,
      value: 15,
    });
    const color = chalkGroup?.controls[2] as ColorControl;
    expect(color).toMatchObject({
      kind: 'color',
      nullable: true,
      value: null,
      inherited: '#112233',
    });
  });

  it('uses a fallback theme schema if the wand has no theme section', () => {
    const { model } = setup([chalk]);
    expect(model.groups[0]?.controls.map((control) => control.key)).toEqual([
      'color',
      'motion',
      'maxDpr',
    ]);
    expect(model.groups[0]?.controls[0]?.value).toBe('#112233');
  });

  it('parses the value and sends a patch for the section', () => {
    const { wand, model } = setup();
    expect(model.set('chalk.size', 72.4)).toBe(true);
    expect(wand.patches).toEqual([{ chalk: { size: 50 } }]);
    expect(model.set('chalk.color', null)).toBe(true);
    expect(model.set('chalk.enabled', false)).toBe(true);
    expect(model.set('theme.color', '#ABCDEF')).toBe(true);
    expect(wand.getConfig()).toMatchObject({
      chalk: { size: 50, color: null, enabled: false },
      theme: { color: '#abcdef' },
    });
    expect(model.groups[1]?.controls[1]?.value).toBe(50);
  });

  it('rejects values and paths that are not valid', () => {
    const { wand, model } = setup();
    expect(model.set('chalk.size', 'big')).toBe(false);
    expect(model.set('theme.color', null)).toBe(false);
    expect(model.set('chalk.unknown', 1)).toBe(false);
    expect(model.set('glitter.size', 1)).toBe(false);
    expect(model.set('size', 1)).toBe(false);
    expect(model.set('theme.enabled', false)).toBe(false);
    expect(wand.patches).toEqual([]);
  });

  it('resets, exports and imports through the wand', () => {
    const { wand, model } = setup();
    model.reset();
    expect(wand.resets).toBe(1);
    expect(JSON.parse(model.exportJson())).toMatchObject({ v: 1, chalk: { size: 15 } });
    expect(model.importJson('{"v":1,"chalk":{"size":9}}')).toBe(true);
    expect(wand.imported).toEqual([{ v: 1, chalk: { size: 9 } }]);
    expect(model.importJson('{not json')).toBe(false);
    expect(wand.imported).toHaveLength(1);
  });

  it('calls the listener on each config event until it unsubscribes', () => {
    const { wand, model } = setup();
    const listener = vi.fn();
    const unsubscribe = model.subscribe(listener);
    model.set('chalk.size', 20);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    model.set('chalk.size', 21);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(wand.listenerCount).toBe(0);
  });
});

describe('panelModel with the sections of the configuration store', () => {
  it('shows one enabled control when the schema has the enabled field', () => {
    const storeChalk: Section = {
      name: 'chalk',
      schema: {
        enabled: field.boolean({
          label: 'Enabled',
          description: 'Turns on the section.',
          default: true,
        }),
        ...chalk.schema,
      },
    };
    const { model } = setup([theme, storeChalk, panel]);
    const group = model.groups.find((candidate) => candidate.name === 'chalk');
    expect(group?.controls.filter((control) => control.path === 'chalk.enabled')).toHaveLength(1);
  });

  it('does not show a group for the panel section', () => {
    const { model } = setup();
    expect(model.groups.map((group) => group.name)).not.toContain('panel');
  });
});
