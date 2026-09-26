# Open the settings panel

Use this procedure to let a visitor or a site owner change the settings with a panel. The panel uses Tweakpane 4.

## Procedure

1. Add Tweakpane to your project:

   ```sh
   pnpm add tweakpane@^4
   ```

2. Import `panelPlugin` from `magic-cursor-wand/panel`.
3. Add the plugin to the `plugins` option. Select the triggers that you need:

   <<< @/snippets/panel.ts#plugin

4. Optional: open the panel from your own control:

   <<< @/snippets/panel.ts#button

5. Push the hotkey, or add the URL parameter to the page address. Make sure that the panel opens.

## Result

The plugin loads Tweakpane only when the panel opens. The panel shows one group for each section and one control for each field.

| Trigger | Result |
|---|---|
| `hotkey` | A key combination opens and closes the panel. |
| `urlParam` | The panel opens when the page address contains this parameter. |
| `launcher` | A small button on the page opens the panel. |

All triggers are off by default. The panel has the buttons Reset, Import and Export. Autosave keeps each change, so the panel has no Save button.
