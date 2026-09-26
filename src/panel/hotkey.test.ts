import { describe, expect, it } from 'vitest';
import { matchesHotkey, parseHotkey } from './hotkey';

function key(init: Partial<KeyboardEvent>): KeyboardEvent {
  return {
    key: '',
    code: '',
    altKey: false,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    ...init,
  } as KeyboardEvent;
}

describe('hotkey', () => {
  it('parses modifiers and the key', () => {
    expect(parseHotkey('Alt+Shift+W')).toEqual({
      key: 'w',
      alt: true,
      shift: true,
      ctrl: false,
      meta: false,
    });
    expect(parseHotkey('Cmd + Option + 1')).toMatchObject({ key: '1', alt: true, meta: true });
    expect(parseHotkey('')).toBeUndefined();
    expect(parseHotkey('Hyper+W')).toBeUndefined();
  });

  it('matches the physical key when the modifiers change the character', () => {
    const hotkey = parseHotkey('Alt+Shift+W');
    if (!hotkey) throw new Error('The hotkey is not valid.');
    expect(
      matchesHotkey(hotkey, key({ key: '„', code: 'KeyW', altKey: true, shiftKey: true })),
    ).toBe(true);
    expect(matchesHotkey(hotkey, key({ key: 'W', code: 'KeyW', shiftKey: true }))).toBe(false);
    expect(
      matchesHotkey(
        hotkey,
        key({ key: 'W', code: 'KeyW', altKey: true, shiftKey: true, ctrlKey: true }),
      ),
    ).toBe(false);
  });

  it('matches digits and named keys', () => {
    const digit = parseHotkey('Ctrl+1');
    const named = parseHotkey('Escape');
    if (!digit || !named) throw new Error('The hotkey is not valid.');
    expect(matchesHotkey(digit, key({ key: '!', code: 'Digit1', ctrlKey: true }))).toBe(true);
    expect(matchesHotkey(named, key({ key: 'Escape', code: 'Escape' }))).toBe(true);
  });
});
