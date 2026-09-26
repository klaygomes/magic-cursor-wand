export interface FieldMeta {
  readonly label: string;
  readonly description: string;
}

interface FieldBase<K extends string, T> extends FieldMeta {
  readonly kind: K;
  readonly default: T;
  parse(input: unknown): T | undefined;
}

export interface NumberField extends FieldBase<'number', number> {
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

export interface ColorField<Nullable extends boolean = boolean>
  extends FieldBase<'color', Nullable extends true ? string | null : string> {
  readonly nullable: Nullable;
}

export interface BooleanField extends FieldBase<'boolean', boolean> {}

export interface EnumField<V extends string = string> extends FieldBase<'enum', V> {
  readonly options: readonly V[];
}

export type Field = NumberField | ColorField | BooleanField | EnumField;

export type Schema = { readonly [key: string]: Field };

export type InferSchema<S extends Schema> = { -readonly [K in keyof S]: S[K]['default'] };

export type Resolved<T> = { [K in keyof T]: null extends T[K] ? Exclude<T[K], null> : T[K] };

export interface Section<N extends string = string, S extends Schema = Schema> {
  readonly name: N;
  readonly schema: S;
}

export type SectionValues<S extends Schema> = InferSchema<S> & { enabled: boolean };

export type ComposeConfig<Sections extends readonly Section[]> = { theme: ThemeConfig } & {
  [X in Sections[number] as X['name']]: SectionValues<X['schema']>;
};

export type ConfigPatch<C> = { [N in keyof C]?: Partial<C[N]> };

export type Motion = 'auto' | 'full' | 'reduced' | 'off';

export interface ThemeConfig {
  color: string;
  motion: Motion;
  maxDpr: number;
}

export const CONFIG_VERSION = 1;

export interface ConfigDocument {
  readonly v: number;
  readonly [section: string]: unknown;
}

export type Migration = (document: ConfigDocument) => ConfigDocument;

export interface ConfigProvider {
  readonly name: string;
  load(signal: AbortSignal): Promise<ConfigDocument | null>;
  save?(document: ConfigDocument, signal: AbortSignal): Promise<void>;
  subscribe?(onChange: (document: ConfigDocument | null) => void): () => void;
}

export interface ConfigStoreOptions<C> {
  readonly sections: readonly Section[];
  readonly defaults?: ConfigPatch<C>;
  readonly providers?: readonly ConfigProvider[];
  readonly locked?: readonly string[];
  readonly autosaveDebounceMs?: number;
  readonly onError?: (error: WandError) => void;
}

export interface SaveOptions {
  readonly to?: string;
}

export interface ConfigStore<C> {
  readonly ready: Promise<void>;
  readonly sections: readonly Section[];
  get(): C;
  set(patch: ConfigPatch<C>): void;
  reset(): void;
  save(options?: SaveOptions): Promise<void>;
  export(): ConfigDocument;
  import(document: unknown): void;
  subscribe(listener: (next: C, previous: C) => void): () => void;
  destroy(): void;
}

export type WandErrorKind = 'provider' | 'validation' | 'effect';

export interface WandError {
  readonly kind: WandErrorKind;
  readonly source: string;
  readonly message: string;
  readonly cause?: unknown;
}
