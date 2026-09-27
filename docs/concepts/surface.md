# Surface

The surface is the canvas where the effects draw. The wand makes the surface in one of two modes.

## Overlay mode

Overlay mode is the default. The wand attaches a fixed canvas that covers the viewport. The canvas has `pointer-events: none`, so the page below it continues to receive clicks.

In overlay mode, the wand attaches the pointer listeners to `window`. Only one overlay wand can exist at a time. A second overlay `createWand` call throws an error.

The default `zIndex` is `2147483647`. Thus the canvas stays above all other layers of the page.

## Container mode

If you give the `target` option, the mode is container mode. The wand attaches an absolute canvas in the target element. A `ResizeObserver` keeps the canvas size equal to the element size.

<<< @/snippets/surface.ts#container

If the position of the target element is `static`, the wand sets the position `relative`. The `destroy` function restores the previous value.

## Positions and scroll

The wand keeps all positions in document coordinates. When the page scrolls, the wand moves the canvas origin one time for each frame. Thus the effects stay at the correct location on the page.

## Pixel density

The canvas size is the CSS size multiplied by the device pixel ratio. The field `theme.maxDpr` sets a limit for this ratio. A low limit decreases the load on the graphics processor.

## Touch input

| Mode | Behavior |
|---|---|
| Overlay | Touch input does not stop the page scroll. A tap makes a burst of glitter. If `shouldDraw` accepts the tap, the tap also makes a short chalk dot. On an element with `touch-action: none`, or in an element with this value, a finger draws a full chalk line. |
| Container | The wand sets `touch-action: none` on the target. The option `touchAction` changes this value. |

## Chalk strokes

The option `shouldDraw` decides if a push of a pointer button starts a chalk stroke. The default is `drawOnPress`. This function accepts the primary button, but not on links, buttons, form controls and `ignoreSelector`.

<<< @/snippets/drawing.ts#modifier

The package also exports `neverDraw`. With this function, the chalk effect never starts a stroke.
