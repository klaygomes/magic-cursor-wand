import { field } from '../config/field';
import type { ConfigPatch, Field, Schema, Section } from '../config/types';
import type { Wand } from '../core/types';

interface ControlBase<K extends string, V> {
  readonly kind: K;
  readonly path: string;
  readonly section: string;
  readonly key: string;
  readonly label: string;
  readonly description: string;
  readonly value: V;
}

/** A slider control for a number field. */
export interface NumberControl extends ControlBase<'number', number> {
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

/** A color control. A nullable color control uses `inherited` when the value is null. */
export interface ColorControl extends ControlBase<'color', string | null> {
  readonly nullable: boolean;
  readonly inherited: string;
}

/** A checkbox control for a boolean field. */
export interface BooleanControl extends ControlBase<'boolean', boolean> {}

/** A list control for an enum field. */
export interface EnumControl extends ControlBase<'enum', string> {
  readonly options: readonly string[];
}

/** A control of the settings panel. */
export type PanelControl = NumberControl | ColorControl | BooleanControl | EnumControl;

/** A group of controls for one configuration section. */
export interface PanelGroup {
  readonly name: string;
  readonly title: string;
  readonly controls: readonly PanelControl[];
}

/** A model of the settings panel that has no dependency on a UI library. */
export interface PanelModel {
  /** The groups with the current values. Each read makes a new snapshot. */
  readonly groups: readonly PanelGroup[];
  /** Set the value at the path `section.field`. Returns false if the value is not valid. */
  set(path: string, value: unknown): boolean;
  /** Remove all changes. */
  reset(): void;
  /** Return the configuration document as formatted JSON. */
  exportJson(): string;
  /** Import a configuration document from JSON text. Returns false if the text is not valid JSON. */
  importJson(text: string): boolean;
  /** Call the listener after each configuration change. Returns a function that removes the listener. */
  subscribe(listener: () => void): () => void;
}

const THEME = 'theme';
const PANEL = 'panel';
const DEFAULT_THEME_COLOR = '#ffffff';

const fallbackThemeSchema: Schema = {
  color: field.color({
    label: 'Color',
    description: 'The main color of all effects.',
    default: DEFAULT_THEME_COLOR,
  }),
  motion: field.enum({
    label: 'Motion',
    description: 'The motion level. The value auto follows the system setting.',
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
};

const enabledField = field.boolean({
  label: 'Enabled',
  description: 'Turn the section on or off.',
  default: true,
});

type ConfigRecord = Record<string, Record<string, unknown> | undefined>;

function titleOf(name: string): string {
  const words = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function orderedSections(sections: readonly Section[]): Section[] {
  const theme = sections.find((section) => section.name === THEME) ?? {
    name: THEME,
    schema: fallbackThemeSchema,
  };
  const others = sections.filter(
    (section) => section.name !== THEME && Object.keys(section.schema).length > 0,
  );
  return [theme, ...others];
}

function controlOf(
  section: string,
  key: string,
  definition: Field,
  value: unknown,
  inherited: string,
): PanelControl {
  const base = {
    path: `${section}.${key}`,
    section,
    key,
    label: definition.label,
    description: definition.description,
  };
  switch (definition.kind) {
    case 'number':
      return {
        ...base,
        kind: 'number',
        value: typeof value === 'number' ? value : definition.default,
        min: definition.min,
        max: definition.max,
        step: definition.step,
      };
    case 'color':
      return {
        ...base,
        kind: 'color',
        value:
          typeof value === 'string' || (value === null && definition.nullable)
            ? value
            : definition.default,
        nullable: definition.nullable,
        inherited,
      };
    case 'boolean':
      return {
        ...base,
        kind: 'boolean',
        value: typeof value === 'boolean' ? value : definition.default,
      };
    case 'enum':
      return {
        ...base,
        kind: 'enum',
        value: typeof value === 'string' ? value : definition.default,
        options: definition.options,
      };
  }
}

function fieldAt(sections: readonly Section[], path: string): Field | undefined {
  const dot = path.indexOf('.');
  if (dot <= 0) return undefined;
  const sectionName = path.slice(0, dot);
  const key = path.slice(dot + 1);
  const section = orderedSections(sections).find((candidate) => candidate.name === sectionName);
  if (!section) return undefined;
  if (key === 'enabled' && sectionName !== THEME) return enabledField;
  return section.schema[key];
}

/**
 * Convert the configuration of a wand to groups and controls for a settings panel.
 *
 * @param wand - The wand that owns the configuration.
 * @returns The panel model. The theme group is always the first group.
 * @example
 * const model = panelModel(wand);
 * model.set('chalk.size', 20);
 */
export function panelModel<C>(wand: Wand<C>): PanelModel {
  const readConfig = (): ConfigRecord => (wand.getConfig() ?? {}) as ConfigRecord;

  return {
    get groups(): readonly PanelGroup[] {
      const config = readConfig();
      const themeColor = config[THEME]?.color;
      const inherited = typeof themeColor === 'string' ? themeColor : DEFAULT_THEME_COLOR;
      const shown = orderedSections(wand.sections).filter((section) => section.name !== PANEL);
      return shown.map((section) => {
        const values = config[section.name] ?? {};
        const controls = Object.keys(section.schema).flatMap((key) => {
          const definition = section.schema[key];
          return definition
            ? [controlOf(section.name, key, definition, values[key], inherited)]
            : [];
        });
        if (section.name !== THEME && !('enabled' in section.schema)) {
          controls.unshift(
            controlOf(section.name, 'enabled', enabledField, values.enabled, inherited),
          );
        }
        return { name: section.name, title: titleOf(section.name), controls };
      });
    },
    set(path, value) {
      const definition = fieldAt(wand.sections, path);
      if (!definition) return false;
      const parsed = definition.parse(value);
      if (parsed === undefined) return false;
      const dot = path.indexOf('.');
      const patch = { [path.slice(0, dot)]: { [path.slice(dot + 1)]: parsed } };
      wand.setConfig(patch as ConfigPatch<C>);
      return true;
    },
    reset() {
      wand.reset();
    },
    exportJson() {
      return JSON.stringify(wand.exportConfig(), null, 2);
    },
    importJson(text) {
      let document: unknown;
      try {
        document = JSON.parse(text);
      } catch {
        return false;
      }
      wand.importConfig(document);
      return true;
    },
    subscribe(listener) {
      return wand.on('config', () => listener());
    },
  };
}
