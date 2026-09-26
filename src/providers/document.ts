import type { ConfigDocument } from '../config/types';

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function isConfigDocument(value: unknown): value is ConfigDocument {
  return isPlainObject(value) && typeof value.v === 'number' && Number.isFinite(value.v);
}

export function toConfigDocument(value: unknown, source: string): ConfigDocument {
  if (!isConfigDocument(value)) {
    throw new Error(
      `The provider "${source}" received a document that is not valid. The document must be an object with a numeric "v".`,
    );
  }
  return value;
}

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
