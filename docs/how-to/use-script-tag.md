# Use a script tag

Use this procedure to add the effects to a page without a bundler. The script build contains the core, the effects, all providers, the cursor plugin and the panel plugin.

## Procedure

1. Add the script element to the end of the `body` element.
2. Add the `data-wand-*` attributes that you need:

   <<< @/snippets/script-tag.html#attributes

3. Keep the `integrity` and `crossorigin` attributes. The browser then refuses a file that is different from the published file.
4. Open the page in a browser.
5. Move the pointer on the page. Make sure that the effects follow the pointer.

## Attributes

| Attribute | Result |
|---|---|
| `data-wand-config-url` | Adds an HTTP provider with this URL. |
| `data-wand-sse-url` | Adds an SSE provider with this URL. |
| `data-wand-storage-key` | Adds a localStorage provider with this key. |
| `data-wand-cursor` | Adds the cursor plugin in this mode: `glow` or `replace`. The build adds the plugin only on a device with a pointer that can hover, for example a mouse. |
| `data-wand-panel-hotkey` | Adds the settings panel with this keyboard shortcut, for example `Alt+Shift+W`. |
| `data-wand-panel` | Adds the settings panel. The value `open` opens the panel at start and removes its Close button. |
| `data-wand-panel-container` | Puts the panel in the element that this CSS selector finds, for example `#settings`. |
| `data-wand-panel-expanded` | Shows the controls of these sections at start, for example `theme,chalk`. |

If the script element has no `data-wand-*` attributes, the build does not start a wand. You can then use the global `MagicCursorWand`:

<<< @/snippets/script-tag.html#global

## Integrity

Each example uses a fixed version and the `integrity` attribute. The release workflow writes the new version and the new hash after each release. To use a different version, get its hash with this command:

```sh
curl -s https://cdn.jsdelivr.net/npm/magic-cursor-wand@0.1.0/dist/magic-cursor-wand.iife.js | openssl dgst -sha384 -binary | openssl base64 -A
```

The settings panel loads Tweakpane with a dynamic import. A browser cannot examine the integrity of a dynamic import. To control this file, give the panel your own `load` function.

## Result

The page shows the effects. The build does not contain React.
