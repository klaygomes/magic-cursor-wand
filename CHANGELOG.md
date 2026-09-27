# magic-cursor-wand

## 0.3.0

### Minor Changes

- 330ef79: In overlay mode, a finger draws a full chalk line on an element with `touch-action: none`, or in such an element. On the rest of the page, touch input continues to scroll the page.

### Patch Changes

- 2a46429: The script tag build adds the cursor plugin only on a device with a pointer that can hover. On a touch device, the settings panel thus shows no cursor settings.

## 0.2.0

### Minor Changes

- ba9cbb3: New default values. The theme color is `#fad30b`, the motion is `full` and the maximum pixel ratio is 1.5. The cloud, chalk and glitter effects have new defaults. To obey `prefers-reduced-motion`, set `theme.motion` to `auto`.
  
  The panel plugin has the option `closable`. The script tag build accepts the attributes `data-wand-panel`, `data-wand-panel-container` and `data-wand-panel-expanded`.
- a243f07: The panel plugin has the option `expanded`. It gives the names of the sections that show their controls when the panel opens. The default is `['theme']`.

### Patch Changes

- c623dc4: When the motion is `off` or the wand is stopped, the plugins continue to get the pointer events. Before this change, the cursor plugin in `replace` mode hid the pointer.

## 0.1.0

### Minor Changes

- First release. The package gives chalk, glitter and cloud pointer effects, configuration providers, a cursor plugin, a settings panel and a React hook.
