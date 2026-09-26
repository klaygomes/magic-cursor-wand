# Troubleshooting

Find the problem in the list. Then do the steps of the solution in sequence.

## The page shows no effects

Possible causes:

- The value of `theme.motion` is `off`.
- The visitor selected reduced motion in the system settings, and only the chalk effect operates.
- An element with a higher `z-index` covers the canvas.

Solution:

1. Call `wand.getConfig()` in the browser console.
2. Make sure that `theme.motion` is not `off`.
3. Make sure that the `enabled` field of each effect is `true`.
4. Set a higher `zIndex` option if an element covers the canvas.

## The second wand throws an error

Only one overlay wand can exist at a time.

Solution:

1. Call `destroy` on the first wand before you make a second wand.
2. Alternatively, give the second wand a `target` element.

## The chalk effect does not draw

The default predicate `drawOnPress` ignores links, buttons, form controls and `ignoreSelector`.

Solution:

1. Push the primary button on an area of the page without interactive elements.
2. Examine the `shouldDraw` option. The preset `neverDraw` stops all chalk strokes.
3. If you use `drawWithModifier`, push the modifier key.

## The settings do not stay after a new load of the page

Solution:

1. Make sure that the `providers` option contains a provider with a `save` function.
2. Make sure that the path is not in the `locked` option.
3. Listen for `error` events. A `provider` error tells you why the save failed.

## The console shows a warning from magic-cursor-wand

The wand writes one warning for each different source of errors.

Solution:

1. Read the `kind` and `source` in the message.
2. Correct the provider, the value or the effect that the message identifies.
3. To stop the warnings, set `silent: true` and listen for `error` events.

## The panel does not open

Solution:

1. Make sure that the project contains Tweakpane 4.
2. Make sure that you added one trigger, for example `hotkey`.
3. On a site with a strict CSP, give the `nonce` option to `panelPlugin`.

## The effects are slow on a large screen

Solution:

1. Set a lower value for `theme.maxDpr`.
2. Set a lower value for `glitter.maxParticles`.
3. Lock the two values. For the procedure, read [Lock a value](/how-to/lock-a-value).
