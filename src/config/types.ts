/** The text that a settings panel shows for a field. */
export interface FieldMeta {
  /** The short name of the field. */
  readonly label: string;
  /** One sentence that tells what the field changes. */
  readonly description: string;
}

interface FieldBase<K extends string, T> extends FieldMeta {
  readonly kind: K;
  readonly default: T;
  parse(input: unknown): T | undefined;
}

/** A number field. `parse` clamps the value to `min` and `max` and rounds it to `step`. */
export interface NumberField extends FieldBase<'number', number> {
  /** The minimum value. */
  readonly min: number;
  /** The maximum value. It is a hard limit. */
  readonly max: number;
  /** The interval between two valid values. */
  readonly step: number;
}

/** A color field in the format `#rrggbb`. A nullable color field also accepts `null` for the theme color. */
export interface ColorField<Nullable extends boolean = boolean>
  extends FieldBase<'color', Nullable extends true ? string | null : string> {
  /** True if the field accepts `null`. */
  readonly nullable: Nullable;
}

/** A boolean field. */
export interface BooleanField extends FieldBase<'boolean', boolean> {}

/** A field with a fixed list of string values. */
export interface EnumField<V extends string = string> extends FieldBase<'enum', V> {
  /** The valid values. */
  readonly options: readonly V[];
}

/** A field of a configuration schema. */
export type Field = NumberField | ColorField | BooleanField | EnumField;

/** The fields of a configuration section, by key. */
export type Schema = { readonly [key: string]: Field };

/** The value type of a schema. */
export type InferSchema<S extends Schema> = { -readonly [K in keyof S]: S[K]['default'] };

/** The value type without `null`. The engine replaces a `null` color with the theme color. */
export type Resolved<T> = { [K in keyof T]: null extends T[K] ? Exclude<T[K], null> : T[K] };

/** A configuration section: a name and a schema. Each effect and each plugin is a section. */
export interface Section<N extends string = string, S extends Schema = Schema> {
  /** The unique name of the section. It is the key in the configuration document. */
  readonly name: N;
  /** The fields of the section. */
  readonly schema: S;
}

/** The values of a section, with the implicit `enabled` field. */
export type SectionValues<S extends Schema> = InferSchema<S> & { enabled: boolean };

/** The configuration type of a wand, from its effects and plugins. */
export type ComposeConfig<Sections extends readonly Section[]> = { theme: ThemeConfig } & {
  [X in Sections[number] as X['name']]: SectionValues<X['schema']>;
};

/** A partial configuration: some fields of some sections. */
export type ConfigPatch<C> = { [N in keyof C]?: Partial<C[N]> };

/** The motion mode of the theme. The value `auto` follows `prefers-reduced-motion`. */
export type Motion = 'auto' | 'full' | 'reduced' | 'off';

/** The values of the core `theme` section. */
export interface ThemeConfig {
  /** The color of each section that has no color of its own. */
  color: string;
  /** The motion mode. */
  motion: Motion;
  /** The maximum device pixel ratio of the canvas. */
  maxDpr: number;
}

/** The version of the configuration document format. */
export const CONFIG_VERSION = 1;

/** A configuration document: `{ "v": 1, "<section>": { "<field>": value } }`. */
export interface ConfigDocument {
  /** The version of the document format. */
  readonly v: number;
  readonly [section: string]: unknown;
}

/** Converts a document of one version to the next version. */
export type Migration = (document: ConfigDocument) => ConfigDocument;

/** A source of configuration documents. */
export interface ConfigProvider {
  /** The unique name of the provider. `save({ to })` uses it. */
  readonly name: string;
  /** Gets the document, or `null` if the source has no document. */
  load(signal: AbortSignal): Promise<ConfigDocument | null>;
  /** Writes the document. A provider without this function cannot save. */
  save?(document: ConfigDocument, signal: AbortSignal): Promise<void>;
  /**
   * Sends each new document from the source. Sends each error of a change to `onError`.
   * Returns a function that stops the subscription.
   */
  subscribe?(
    onChange: (document: ConfigDocument | null) => void,
    onError?: (error: unknown) => void,
  ): () => void;
}

/** The options of the configuration store. */
export interface ConfigStoreOptions<C> {
  /** The sections of the effects and the plugins. */
  readonly sections: readonly Section[];
  /** The configuration layer above the schema defaults. */
  readonly defaults?: ConfigPatch<C>;
  /** The providers, from low to high precedence. */
  readonly providers?: readonly ConfigProvider[];
  /** The paths that the providers and the runtime layer cannot change. */
  readonly locked?: readonly string[];
  /** The time between the last change and the autosave, in milliseconds. */
  readonly autosaveDebounceMs?: number;
  /** Receives the provider and validation errors. */
  readonly onError?: (error: WandError) => void;
}

/** The options of a save. */
export interface SaveOptions {
  /** The name of the target provider. The default is the last provider that can save. */
  readonly to?: string;
}

/** Merges the configuration layers and saves the difference. */
export interface ConfigStore<C> {
  /** Resolves after all providers settle. It never rejects. */
  readonly ready: Promise<void>;
  /** The sections, with the theme section first. */
  readonly sections: readonly Section[];
  /** Gives the merged configuration of the known sections. */
  get(): C;
  /** Changes the runtime layer. */
  set(patch: ConfigPatch<C>): void;
  /** Removes the runtime layer and the difference of the target provider. */
  reset(): void;
  /** Saves the difference to the target provider. */
  save(options?: SaveOptions): Promise<void>;
  /** Gives the merged configuration of all sections as a document. */
  export(): ConfigDocument;
  /** Puts a document in the runtime layer. */
  import(document: unknown): void;
  /** Adds a listener for changes of the merged configuration. */
  subscribe(listener: (next: C, previous: C) => void): () => void;
  /** Stops all requests and removes all listeners. */
  destroy(): void;
}

/** The kind of a wand error. */
export type WandErrorKind = 'provider' | 'validation' | 'effect';

/** An error that the wand emits. The wand continues to operate. */
export interface WandError {
  /** The kind of the error. */
  readonly kind: WandErrorKind;
  /** The provider, the section or the function that caused the error. */
  readonly source: string;
  /** A message in Simplified Technical English. */
  readonly message: string;
  /** The original error or value. */
  readonly cause?: unknown;
}
