# Get started

This page shows how to add the default effects to a page with a bundler. For a page without a bundler, read [Use a script tag](/how-to/use-script-tag).

## Requirements

- A bundler that reads ES modules, for example Vite.
- A browser from the list of [supported browsers](#supported-browsers).

## Procedure

1. Add the package to your project:

   ```sh
   pnpm add magic-cursor-wand
   ```

2. Import `createWand` and call it one time when the page starts:

   <<< @/snippets/getting-started.ts#start

3. Move the pointer on the page. Make sure that the cloud and glitter effects follow the pointer.
4. Push the primary button and move the pointer. Make sure that the chalk effect draws a line.
5. To change a value, call `setConfig`:

   <<< @/snippets/getting-started.ts#change

6. To remove the canvas and all listeners, call `destroy`:

   <<< @/snippets/getting-started.ts#destroy

## Result

The wand shows the cloud, chalk and glitter effects in a fixed canvas above the page. The canvas does not stop clicks.

## Supported browsers

| Browser | Minimum version |
|---|---|
| Chrome and Edge | 88 |
| Firefox | 85 |
| Safari and Safari on iOS | 14.5 |

## Next steps

- Read about the [surface](/concepts/surface) and the [configuration](/concepts/configuration).
- [Keep the settings in the browser](/how-to/add-local-storage).
- [Open the settings panel](/how-to/open-the-panel).
