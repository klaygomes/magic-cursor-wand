# Keep settings in the browser

Use this procedure to keep the settings of each visitor in `localStorage`. The settings stay after the visitor closes the page.

## Procedure

1. Import `localStorageProvider` from `magic-cursor-wand/providers`.
2. Add the provider to the `providers` option with a unique key:

   <<< @/snippets/local-storage.ts#local

3. Change a value with `setConfig` or with the settings panel.
4. Load the page again. Make sure that the changed value stays.

## Result

The wand saves each change 500 milliseconds after the last change. The provider also receives changes from other tabs through the `storage` event.

To save at once, call `save`:

<<< @/snippets/local-storage.ts#save

Some browsers throw an error for `localStorage` in private mode. In this condition, the provider returns no document, and the wand uses the other layers.
