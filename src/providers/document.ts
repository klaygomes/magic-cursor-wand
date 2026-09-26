import type { ConfigDocument } from '../config/types';

/**
 * Tells if a value is a plain object.
 *
 * @param value - The value.
 * @returns True for an object with the prototype `Object.prototype` or `null`.
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Tells if a value is a configuration document.
 *
 * @param value - The value.
 * @returns True for a plain object with a numeric `v`.
 */
export function isConfigDocument(value: unknown): value is ConfigDocument {
  return isPlainObject(value) && typeof value.v === 'number' && Number.isFinite(value.v);
}

/**
 * Gives the value as a configuration document, or throws an error.
 *
 * @param value - The value.
 * @param source - The provider name for the error message.
 * @returns The document.
 */
export function toConfigDocument(value: unknown, source: string): ConfigDocument {
  if (!isConfigDocument(value)) {
    throw new Error(
      `The provider "${source}" received a document that is not valid. The document must be an object with a numeric "v".`,
    );
  }
  return value;
}

/**
 * Merges documents in order, section by section and field by field.
 *
 * @param documents - The documents, from low to high precedence.
 * @returns The merged document, or `null` if the list is empty.
 */
export function mergeDocuments(documents: readonly ConfigDocument[]): ConfigDocument | null {
  let merged: Record<string, unknown> | null = null;
  for (const document of documents) {
    merged ??= {};
    for (const [key, value] of Object.entries(document)) {
      const previous = merged[key];
      merged[key] =
        isPlainObject(previous) && isPlainObject(value) ? { ...previous, ...value } : value;
    }
  }
  return merged as ConfigDocument | null;
}
