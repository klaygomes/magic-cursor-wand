# Plugins

A plugin adds a feature to a wand, but it does not draw on the canvas. Like an effect, a plugin is a configuration section with its own schema.

## Built-in plugins

| Plugin | Entry | Description |
|---|---|---|
| `cursorPlugin()` | `magic-cursor-wand/cursor` | Adds a glow at the pointer, or replaces the native cursor with an arrow. |
| `panelPlugin()` | `magic-cursor-wand/panel` | Shows a settings panel with Tweakpane. |

## The cursor plugin

In `glow` mode, the native cursor stays and the plugin adds a glow. In `replace` mode, the plugin hides the native cursor and shows an arrow. Over links, buttons and form controls, the native cursor shows again.

<<< @/snippets/cursor.ts#cursor

The plugin hides the cursor for touch input and when the pointer leaves the window. The option `render(element)` replaces the arrow with your own content.

## The settings panel

The panel plugin loads Tweakpane only when the panel opens. The panel has the buttons Reset, Import and Export. It has no Save button, because autosave is always on.

For a procedure, read [Open the settings panel](/how-to/open-the-panel).

## Your own plugin

A plugin has a `name`, a `schema` and a `setup` function. The `setup` function gets a context with the wand, the event bus, the surface and a pointer listener.

<<< @/snippets/plugin.ts#plugin

<<< @/snippets/plugin.ts#register

The functions `configure` and `destroy` are optional. The wand calls `configure` with the resolved section values after each change.
