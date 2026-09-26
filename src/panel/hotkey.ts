/** A parsed keyboard shortcut. */
export interface Hotkey {
  readonly key: string;
  readonly alt: boolean;
  readonly shift: boolean;
  readonly ctrl: boolean;
  readonly meta: boolean;
}

const MODIFIERS: Record<string, keyof Omit<Hotkey, 'key'>> = {
  alt: 'alt',
  option: 'alt',
  shift: 'shift',
  ctrl: 'ctrl',
  control: 'ctrl',
  meta: 'meta',
  cmd: 'meta',
  command: 'meta',
};

/**
 * Parse a keyboard shortcut such as `Alt+Shift+W`.
 *
 * @param text - The modifiers and the key, with `+` between them.
 * @returns The parsed shortcut, or undefined if the text has no key.
 */
export function parseHotkey(text: string): Hotkey | undefined {
  const parts = text
    .split('+')
    .map((part) => part.trim())
    .filter((part) => part !== '');
  const key = parts.pop();
  if (!key) return undefined;
  const hotkey = { key: key.toLowerCase(), alt: false, shift: false, ctrl: false, meta: false };
  for (const part of parts) {
    const modifier = MODIFIERS[part.toLowerCase()];
    if (!modifier) return undefined;
    hotkey[modifier] = true;
  }
  return hotkey;
}

/**
 * Compare a keyboard event with a shortcut. The comparison uses the physical key for letters and digits.
 *
 * @param hotkey - The shortcut.
 * @param event - The keyboard event.
 * @returns True if the event matches the shortcut.
 */
export function matchesHotkey(hotkey: Hotkey, event: KeyboardEvent): boolean {
  if (
    event.altKey !== hotkey.alt ||
    event.shiftKey !== hotkey.shift ||
    event.ctrlKey !== hotkey.ctrl ||
    event.metaKey !== hotkey.meta
  ) {
    return false;
  }
  if (/^[a-z]$/.test(hotkey.key) && event.code === `Key${hotkey.key.toUpperCase()}`) return true;
  if (/^[0-9]$/.test(hotkey.key) && event.code === `Digit${hotkey.key}`) return true;
  return event.key.toLowerCase() === hotkey.key;
}
