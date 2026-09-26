# Reference

The reference gives the names, types and default values of the public API.

## Parts of the reference

- [Configuration](/reference/configuration) shows each section and field of the default schema.
- [API](/reference/api/) shows each exported function and type. TypeDoc makes these pages from the TSDoc comments in the source code.

## Package entries

| Entry | Contents |
|---|---|
| `magic-cursor-wand` | `createWand`, the effects, the `field` builders, the draw presets and all shared types. |
| `magic-cursor-wand/providers` | `staticProvider`, `localStorageProvider`, `httpProvider`, `eventSourceProvider` and `compositeProvider`. |
| `magic-cursor-wand/cursor` | `cursorPlugin`. |
| `magic-cursor-wand/panel` | `panelPlugin` and `panelModel`. |
| `magic-cursor-wand/react` | `useWand`. |
| `magic-cursor-wand/dist/magic-cursor-wand.iife.js` | The script build with the global `MagicCursorWand`. |

## Wand functions

| Function | Result |
|---|---|
| `wand.ready` | A promise that resolves after all providers settle. |
| `wand.getConfig()` | Returns the merged configuration. |
| `wand.setConfig(patch)` | Merges the patch into the runtime layer. |
| `wand.save(options)` | Saves the difference to a provider at once. |
| `wand.reset()` | Removes the saved difference and clears the runtime layer. |
| `wand.exportConfig()` | Returns the configuration as a document. |
| `wand.importConfig(document)` | Reads a document into the runtime layer. |
| `wand.on(type, handler)` | Adds a listener for `config`, `error` or `ready`. |
| `wand.start()` and `wand.stop()` | Start and stop the frame loop. |
| `wand.destroy()` | Removes the canvas, the listeners and the open requests. |
