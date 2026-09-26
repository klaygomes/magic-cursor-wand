# Effects

An effect draws on the surface. Each effect is also a configuration section with its own schema.

## Built-in effects

| Effect | Layer | Composite operation | Description |
|---|---|---|---|
| `cloudEffect()` | 0 | `source-over` | Soft clouds that rise and fade near the pointer. |
| `chalkEffect()` | 10 | `source-over` | A chalk line while the pointer button is down. The line fades after a short time. |
| `glitterEffect()` | 20 | `lighter` | Particles that twinkle, turn and fall. |

If you do not give the `effects` option, the wand uses all three effects. If you give the option, the wand uses only the effects in the list.

The glitter effect draws its sprites from two paths in the source code. It makes no network requests. To use a different image, give `glitterEffect({ sprite })` a `CanvasImageSource`.

## The frame loop

The wand sorts the effects by `layer`. For each frame, the wand calls `update` and then `draw` for each enabled effect. Before each `draw`, the wand resets `globalAlpha`, `globalCompositeOperation` and the transform.

When an effect becomes disabled, the wand calls its `clear` function. When all effects are idle and no pointer is active, the loop sleeps. The loop also stops while the page is not visible.

## Errors in an effect

If an effect throws an error in three frames in sequence, the wand disables the effect. The wand then emits an `effect` error. The other effects continue.

## Random values and time

An effect must get random values from `context.random()`, not from `Math.random`. Tests can then give a seeded function to the `random` option. The `scheduler` option replaces `requestAnimationFrame` and `performance.now` in the same way.

## Your own effect

For a procedure, read [Write an effect](/how-to/write-an-effect).
