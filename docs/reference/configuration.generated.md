<!-- The script scripts/config-table.ts writes this file. Do not edit it. -->

## `theme`

| Path | Type | Default | Range | Description |
| --- | --- | --- | --- | --- |
| `theme.color` | Color | `#ffffff` | `#rrggbb` | The color of each section that has no color of its own. |
| `theme.motion` | `auto`, `full`, `reduced`, `off` | `auto` |  | The motion mode. The value "auto" follows the reduced motion option of the system. |
| `theme.maxDpr` | Number | `2` | `1` to `3`, step `0.5` | The maximum device pixel ratio of the canvas. |

## `cloud`

| Path | Type | Default | Range | Description |
| --- | --- | --- | --- | --- |
| `cloud.size` | Number | `40` | `10` to `150`, step `1` | The minimum radius of a new cloud in pixels. |
| `cloud.density` | Number | `0.4` | `0.1` to `1`, step `0.05` | The chance of a new cloud in each frame while the pointer moves. |
| `cloud.bounce` | Number | `60` | `0` to `150`, step `1` | The range of the noise wobble in pixels. The value 0 stops the wobble. |
| `cloud.spread` | Number | `30` | `0` to `200`, step `1` | The size of the area around the pointer where new clouds start. |
| `cloud.fadeRate` | Number | `0.015` | `0.001` to `0.05`, step `0.001` | The speed at which a cloud disappears. |
| `cloud.color` | Color or `null` | `null` (uses `theme.color`) | `#rrggbb` | The color of the clouds. The value null uses the theme color. |
| `cloud.maxClouds` | Number | `300` | `1` to `1000`, step `1` | The maximum number of clouds on the screen. |
| `cloud.enabled` | Boolean | `true` |  | The section operates only when this value is `true`. |

## `chalk`

| Path | Type | Default | Range | Description |
| --- | --- | --- | --- | --- |
| `chalk.size` | Number | `15` | `1` to `50`, step `1` | The width of the stroke in pixels. |
| `chalk.maxLength` | Number | `600` | `50` to `2000`, step `10` | The maximum length of a stroke in pixels. The oldest part of the stroke dissolves. |
| `chalk.smoothing` | Number | `0.75` | `0` to `0.95`, step `0.05` | The steadiness of the line. The value 0 uses the raw pointer positions. |
| `chalk.softness` | Number | `0.5` | `0` to `1`, step `0.05` | The width of the feathered edge. The value 0 gives a crisp edge. |
| `chalk.taper` | Number | `0.6` | `0` to `1`, step `0.05` | The length of the thin tips at the two ends of the stroke. |
| `chalk.fadeRate` | Number | `0.005` | `0.001` to `0.05`, step `0.001` | The speed at which a finished stroke disappears. |
| `chalk.color` | Color or `null` | `null` (uses `theme.color`) | `#rrggbb` | The color of the chalk. The value null uses the theme color. |
| `chalk.enabled` | Boolean | `true` |  | The section operates only when this value is `true`. |

## `glitter`

| Path | Type | Default | Range | Description |
| --- | --- | --- | --- | --- |
| `glitter.size` | Number | `10` | `1` to `50`, step `1` | The base size of a glitter particle in pixels. |
| `glitter.spawnRate` | Number | `4` | `1` to `20`, step `1` | The minimum number of particles for each burst. |
| `glitter.gravity` | Number | `0.02` | `-0.1` to `0.2`, step `0.01` | The downward pull on each particle. A negative value lifts the particles. |
| `glitter.friction` | Number | `0.98` | `0.8` to `1`, step `0.01` | The part of the speed that a particle keeps in each frame. |
| `glitter.fadeRate` | Number | `0.015` | `0.001` to `0.05`, step `0.001` | The speed at which a particle disappears. |
| `glitter.twinkle` | Number | `6` | `1` to `20`, step `1` | The sharpness of the twinkle. A high value gives short flashes. |
| `glitter.color` | Color or `null` | `null` (uses `theme.color`) | `#rrggbb` | The color of the glitter. The value null uses the theme color. |
| `glitter.maxParticles` | Number | `2000` | `1` to `5000`, step `1` | The maximum number of glitter particles on the screen. |
| `glitter.enabled` | Boolean | `true` |  | The section operates only when this value is `true`. |

## `cursor`

| Path | Type | Default | Range | Description |
| --- | --- | --- | --- | --- |
| `cursor.glowSize` | Number | `80` | `0` to `240`, step `2` | The diameter of the glow in pixels. The value 0 removes the glow. |
| `cursor.glowStrength` | Number | `0.55` | `0` to `1`, step `0.05` | The opacity of the glow. |
| `cursor.glowPress` | Number | `1.25` | `1` to `2.5`, step `0.05` | The scale of the glow while the pointer button is down. |
| `cursor.color` | Color or `null` | `null` (uses `theme.color`) | `#rrggbb` | The color of the glow. The value null uses the theme color. |
| `cursor.enabled` | Boolean | `true` |  | The section operates only when this value is `true`. |
