# Decrease the motion

Use this procedure to control the motion of the effects. By default, the wand obeys the `prefers-reduced-motion` media query of the visitor.

## Procedure

1. Select a value for `theme.motion` from the table in [Result](#result).
2. Put the value in the `config` option:

   <<< @/snippets/reduced-motion.ts#motion

3. To stop all effects at runtime, set the value `off`:

   <<< @/snippets/reduced-motion.ts#off

## Result

| Value | Behavior |
|---|---|
| `auto` | The wand follows `prefers-reduced-motion` and updates when the media query changes. |
| `full` | The wand shows all motion. |
| `reduced` | The wand shows reduced motion. |
| `off` | The wand stops. |

With reduced motion, each effect operates as this table shows:

| Effect | Behavior |
|---|---|
| Glitter | Off |
| Cloud | Off |
| Chalk | On. The line fades without drift. |
| Cursor glow | Static |
