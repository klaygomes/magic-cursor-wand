# Write an effect

Use this procedure to make a new effect. The example effect draws a dot at the pointer.

## Procedure

1. Make a schema for the settings of the effect with the `field` builders:

   <<< @/snippets/custom-effect.ts#schema

2. Write a function that returns an object of the type `Effect`:

   <<< @/snippets/custom-effect.ts#effect

3. Give the effect to `createWand` in the `effects` option:

   <<< @/snippets/custom-effect.ts#register

4. Move the pointer on the page. Make sure that the dot follows the pointer.

## Result

The wand calls `configure` with the resolved values of the section. A nullable color with the value `null` arrives as the value of `theme.color`.

## Rules for effects

- Use `context.random()` for random values, not `Math.random`.
- Keep positions in document coordinates. The wand applies the scroll offset before `draw`.
- Return `true` from `isIdle` when the effect has nothing to draw. Then the frame loop can sleep.
- Do not allocate objects in `update` and `draw`, if possible.
- Do not change the canvas state that the wand resets, for example the transform, in a different function.
- Read `frame.reducedMotion` and decrease the motion when it is `true`.
