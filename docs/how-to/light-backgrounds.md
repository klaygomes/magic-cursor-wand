# Use light backgrounds

Use this procedure on a page with a light background. The default colors of the effects are white, so they are not easy to see on a light page.

## Procedure

1. Select a dark color in the format `#rrggbb`.
2. Put the color in `theme.color`.
3. Optional: give a different color to one effect:

   <<< @/snippets/light-backgrounds.ts#colors

4. Open the page. Make sure that the effects have good contrast with the background.

## Result

Each effect that has the color `null` gets the value of `theme.color`. An effect with its own color keeps that color.

The glitter effect uses the `lighter` composite operation. On a light background, this operation makes the particles less visible. Use a color with high saturation for glitter.
