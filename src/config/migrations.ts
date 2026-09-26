import { hasOwn, isRecord } from './object';
import { CONFIG_VERSION, type ConfigDocument, type Migration } from './types';

/**
 * The registry of document migrations. The key is the source version. The migration converts a document of that version to the next version.
 */
export const migrations: Readonly<Record<number, Migration>> = {};

/**
 * The result of a migration: the migrated document, or a message that tells why the document is not valid.
 */
export type MigrationResult =
  | { readonly ok: true; readonly document: ConfigDocument }
  | { readonly ok: false; readonly message: string; readonly cause?: unknown };

/**
 * Applies the migrations in sequence from the document version to the target version.
 *
 * A document from a later version stays the same. The store then reads it field by field.
 *
 * @param input - The document to migrate.
 * @param registry - The migrations, keyed by source version.
 * @param targetVersion - The version to reach.
 * @returns The migrated document, or a failure with a message.
 * @example
 * const result = migrateDocument({ v: 1, chalk: { size: 20 } });
 */
export function migrateDocument(
  input: unknown,
  registry: Readonly<Record<number, Migration>> = migrations,
  targetVersion: number = CONFIG_VERSION,
): MigrationResult {
  if (!isRecord(input)) return { ok: false, message: 'The document is not an object.' };
  const version = input.v;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { ok: false, message: 'The document does not have a valid version number "v".' };
  }
  let document = input as ConfigDocument;
  for (let current = version; current < targetVersion; current += 1) {
    const step = hasOwn(registry, current) ? registry[current] : undefined;
    if (!step) {
      return {
        ok: false,
        message: `No migration exists from version ${current} to version ${current + 1}.`,
      };
    }
    try {
      document = { ...step(document), v: current + 1 };
    } catch (cause) {
      return { ok: false, message: `The migration from version ${current} failed.`, cause };
    }
  }
  return { ok: true, document };
}
