# Use a script tag

Use this procedure to add the effects to a page without a bundler. The script build contains the core, the effects, all providers, the cursor plugin and the panel plugin.

## Procedure

1. Add the script element to the end of the `body` element.
2. Add the `data-wand-*` attributes that you need:

   <<< @/snippets/script-tag.html#attributes

3. Open the page in a browser.
4. Move the pointer on the page. Make sure that the effects follow the pointer.

## Attributes

| Attribute | Result |
|---|---|
| `data-wand-config-url` | Adds an HTTP provider with this URL. |
| `data-wand-storage-key` | Adds a localStorage provider with this key. |
| `data-wand-cursor` | Adds the cursor plugin in this mode. |

If the script element has no `data-wand-*` attributes, the build does not start a wand. You can then use the global `MagicCursorWand`:

<<< @/snippets/script-tag.html#global

## Result

The page shows the effects. The build does not contain React.
