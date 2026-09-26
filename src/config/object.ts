/** An object with string keys. */
export type PlainRecord = Record<string, unknown>;

/**
 * Tells if a value is an object that is not an array.
 *
 * @param value - The value.
 * @returns True for an object that is not an array.
 */
export function isRecord(value: unknown): value is PlainRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Gives the entries of an object without the key `__proto__`.
 *
 * @param value - The object.
 * @returns The key and value pairs.
 */
export function ownEntries(value: PlainRecord): [string, unknown][] {
  return Object.entries(value).filter(([key]) => key !== '__proto__');
}

/**
 * Tells if an object has its own property with the key.
 *
 * @param value - The object.
 * @param key - The key.
 * @returns True if the object has the property.
 */
export function hasOwn(value: object, key: PropertyKey): boolean {
  // biome-ignore lint/suspicious/noPrototypeBuiltins: Object.hasOwn is ES2022 and Safari 14.5 does not have it.
  return Object.prototype.hasOwnProperty.call(value, key);
}

/**
 * Compares two JSON values by structure.
 *
 * @param a - The first value.
 * @param b - The second value.
 * @returns True if the values are equal.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => deepEqual(item, b[index]));
  }
  if (isRecord(a) && isRecord(b)) {
    const keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length) return false;
    return keys.every((key) => hasOwn(b, key) && deepEqual(a[key], b[key]));
  }
  return false;
}

/**
 * Copies a JSON value. The copy has no key `__proto__`.
 *
 * @param value - The value.
 * @returns The copy.
 */
export function cloneData<T>(value: T): T {
  if (Array.isArray(value)) return value.map(cloneData) as T;
  if (isRecord(value)) {
    const copy: PlainRecord = {};
    for (const [key, item] of ownEntries(value)) copy[key] = cloneData(item);
    return copy as T;
  }
  return value;
}
