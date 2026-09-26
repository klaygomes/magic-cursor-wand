# magic-cursor-wand: implementation plan

This document is the specification for version 1. Write all project prose in ASD-STE100 Simplified Technical English (STE). This file obeys the same rules.

## 1. Purpose

The library shows chalk, glitter and cloud effects that follow the pointer in a web browser. The source of the effects is the demo page `reference/demo.html`. The library must:

- Operate in all browsers that section 9 specifies.
- Accept new effects, plugins and configuration providers without changes to the core code.
- Get its configuration from providers. A provider can be asynchronous (HTTP, SSE) or local (localStorage).

## 2. Layers

The library has four layers. A layer uses only the layers below it.

| Layer | Directory | Contents |
|---|---|---|
| Add-ons | `src/cursor`, `src/panel`, `src/react` | Cursor plugin, settings panel, React hook |
| Effects | `src/effects` | Cloud, chalk and glitter effects |
| Engine | `src/core` | Surface, scheduler, pointer input, event bus, `createWand` |
| Configuration | `src/config`, `src/providers` | Schema fields, store, migrations, providers |

The shared types are in `src/config/types.ts` and `src/core/types.ts`. Do not change these types without a record in section 12.

## 3. Surface

1. The default mode is `overlay`. The engine attaches a fixed canvas that covers the viewport. The canvas has `pointer-events: none`, so the page below it continues to receive clicks.
2. In overlay mode, the engine attaches the pointer listeners to `window`.
3. If the options contain `target`, the mode is `container`. The engine attaches an absolute canvas in the target element. A `ResizeObserver` sets the canvas size. The engine attaches the pointer listeners to the target.
4. The engine keeps all positions in document coordinates. For overlay mode, a position is `clientX + scrollX`. For container mode, a position is the offset in the element plus the element scroll offset. For each frame, the engine applies one translation that subtracts the scroll offset.
5. A scroll event starts the frame loop if the loop is asleep.
6. Only one overlay instance can exist at a time. A second overlay `createWand` call throws an error with a clear message.
7. The default `zIndex` is `2147483647`.
8. The canvas size is the CSS size multiplied by `min(devicePixelRatio, theme.maxDpr)`.

## 4. Pointer input and chalk strokes

1. The engine uses Pointer Events only. It uses `getCoalescedEvents` if the browser supports it.
2. The option `shouldDraw(event)` decides if a `pointerdown` starts a chalk stroke.
3. The default predicate `drawOnPress` returns true for the primary button. It returns false if the target matches the interactive selector or `ignoreSelector`. The interactive selector is `a, button, input, textarea, select, label, [contenteditable]`.
4. The package exports these presets: `drawOnPress`, `drawWithModifier(key)` and `neverDraw`.
5. During a stroke, the engine sets `user-select: none` on the root element. At the end of the stroke, the engine restores the previous value.
6. Touch input in overlay mode:
   - Touch input must not stop the page scroll.
   - A tap emits a `burst` event and makes a short chalk dot.
   - On `pointercancel`, the engine ends the stroke without an error.
7. Touch input in container mode: the engine sets `touch-action: none` on the target. The option `touchAction` changes this value.

## 5. Configuration

### 5.1 Sections and fields

1. Each effect and each plugin is a `Section`. A section has a `name` and a `schema`.
2. The core owns the `theme` section: `color`, `motion` and `maxDpr`.
3. Each section also gets an implicit `enabled` field. The default value is `true`.
4. The field builders are `field.number`, `field.color`, `field.boolean` and `field.enum`. Each field has `label`, `description` and `default`.
5. `parse(input)` returns a valid value or `undefined`. A number field clamps the value to `min` and `max` and rounds the value to `step`. A color field accepts `#rrggbb` only and returns lowercase. A nullable color field also accepts `null`.
6. A nullable color field with the value `null` gets `theme.color`. Effects receive resolved values, so an effect never reads a different section.
7. The performance limits are schema fields, for example `glitter.maxParticles`. The schema `max` of each limit is a hard limit. Select safe values for `max`.

### 5.2 Layers and precedence

The store merges these layers. A later layer overrides an earlier layer, field by field:

1. Schema defaults.
2. `options.config`.
3. Each provider, in the order of `options.providers`.
4. The runtime layer, from `setConfig`.

The store removes the paths in `options.locked` (for example `glitter.maxParticles`) from each provider layer and from the runtime layer.

### 5.3 Load

1. The wand starts at once with layers 1 and 2.
2. Each provider has one slot. When a provider result arrives, the store puts it in the slot and merges all layers again. Thus a slow provider with low precedence cannot override a fast provider with high precedence.
3. `wand.ready` resolves after all providers settle. It never rejects.
4. `startAfter: 'ready'` or `startAfter: <ms>` delays the first frame.
5. On `destroy()`, the store stops all requests with an `AbortController`.

### 5.4 Save

1. Autosave is always on. After `setConfig`, the store waits `autosaveDebounceMs` (default 500) and then saves.
2. The store saves to the last provider that has a `save` method. `save({ to: name })` selects a different provider.
3. The saved document contains only the difference. The difference is the merged result of all layers minus the merged result of the layers below the target provider.
4. After a save, the target slot gets the difference and the runtime layer becomes empty.
5. A change that comes from a provider (`subscribe`) never starts a save. This prevents loops between tabs or between the client and the server.
6. `reset()` removes the difference from the target provider and clears the runtime layer.

### 5.5 Document format and versions

1. The format is `{ "v": 1, "<section>": { "<field>": value } }`.
2. The core owns all migrations. The store applies the migrations in sequence from the document version to `CONFIG_VERSION`.
3. The store keeps sections that it does not know. A remote document can contain settings for an effect that the page does not load.
4. The store ignores values that are not valid and emits a `validation` error.

## 6. Providers

| Provider | Load | Save | Subscribe |
|---|---|---|---|
| `staticProvider(document)` | Returns the document | No | No |
| `localStorageProvider({ key, storage })` | Reads the key | Writes the key | The `storage` event |
| `httpProvider({ url, headers, pollMs, save })` | One GET | PUT (or POST) if you set `save` | Polling with ETag and `If-None-Match` if you set `pollMs` |
| `eventSourceProvider({ url, withCredentials })` | The first message | No | Each message |
| `compositeProvider(name, providers)` | Merges the documents in order | Sends the document to each writable provider | Merges the changes |

1. Each provider uses the fixed document format of section 5.5. There are no encode or decode hooks.
2. The only HTTP option for headers is a static `headers` object. `EventSource` cannot send headers, thus it uses cookies with `withCredentials`.
3. Polling stops while `document.hidden` is true.
4. Each SSE message contains a full document. The provider replaces the slot. Thus a lost message does not cause a permanent difference.
5. Wrap each access to `localStorage` in `try` and `catch`. Some browsers throw an error in private mode.

## 7. Engine

### 7.1 Effects

1. The set of effects does not change after `createWand`.
2. The engine sorts the effects by `layer`. Before each `draw`, the engine resets `globalAlpha`, `globalCompositeOperation` and the transform.
3. The engine calls `update` and `draw` only for enabled effects. When an effect becomes disabled, the engine calls `clear`.
4. If an effect throws an error three frames in sequence, the engine disables it and emits an `effect` error.
5. When all effects are idle and no pointer is active, the loop sleeps.
6. The engine stops the loop while `document.hidden` is true.

### 7.2 Scheduler and instances

1. All instances share one animation loop and one set of `window` listeners. A reference count controls them. The last `destroy()` removes them.
2. The option `scheduler` replaces `requestAnimationFrame` and `performance.now`. Tests use a manual scheduler to move the time frame by frame.
3. The option `random` replaces `Math.random`. Effects must use `context.random()`.

### 7.3 Event bus

1. Events tell an intent, not a source. Example: `burst { x, y, strength }`. Chalk emits it and glitter listens for it.
2. Other packages add events with module augmentation of `WandEvents`.
3. Dispatch is synchronous. Do not allocate a new payload object for each event in the frame loop.

### 7.4 Errors

1. After `createWand` returns, the library does not throw errors. It emits `error` events: `{ kind, source, message, cause }`.
2. The default listener writes one `console.warn` for each different source. The option `silent: true` stops this.
3. Error and warning messages obey STE.

### 7.5 Reduced motion

`theme.motion` has the values `auto`, `full`, `reduced` and `off`. The value `auto` follows `prefers-reduced-motion` and updates when the media query changes. The value `off` stops the engine. Each frame gives `frame.reducedMotion` to the effects.

| Effect | Behavior with reduced motion |
|---|---|
| Glitter | Off |
| Cloud | Off |
| Chalk | On. The stroke fades without the drift. |
| Cursor glow | Static |

### 7.6 Public API

```ts
const wand = createWand({ effects, plugins, config, providers, target });
wand.ready;
wand.getConfig();
wand.setConfig({ chalk: { size: 20 } });
wand.save({ to: 'local' });
wand.reset();
wand.exportConfig();
wand.importConfig(document);
wand.on('config' | 'error' | 'ready', handler);
wand.start();
wand.stop();
wand.destroy();
```

`createWand` infers the config type from the effects and plugins with `ComposeConfig`. If the options do not contain `effects`, the defaults are `[cloudEffect(), chalkEffect(), glitterEffect()]`.

## 8. Effects

Port each effect from the demo. Keep the demo values as the defaults.

| Effect | Layer | Composite | Notes |
|---|---|---|---|
| `cloudEffect` | 0 | `source-over` | Value noise wobble, rise, fade in and out |
| `chalkEffect` | 10 | `source-over` | Feather layers, taper, smooth curves, maximum length, vanish with drift. Emits `burst`. |
| `glitterEffect` | 20 | `lighter` | Twinkle, rotation, gravity, friction. Listens for `burst`. |

1. The glitter sprite comes from the paths in `src/effects/glow_mask.reference.svg`. The author of the demo made this file. Copy the two path strings into the source code. Draw each path with `Path2D` and `shadowBlur`. Do not use `ctx.filter`, because Safari before version 18 does not support it. The result is two sprites with the correct aspect ratio. Each particle selects one sprite at random.
2. The library makes no network requests for sprites. The option `glitterEffect({ sprite })` accepts a custom `CanvasImageSource`.
3. The default colors are white. The site owner sets the colors for light pages.

## 9. Browsers, styles and security

1. Minimum versions: Chrome and Edge 88, Firefox 85, Safari and iOS 14.5. The build target is ES2020.
2. Do not use a `<style>` element. Set all styles with `element.style`. Thus the library operates with a strict Content Security Policy.
3. Use feature detection for `getCoalescedEvents`.
4. Do not access `window` or `document` when a module loads. Server-side rendering must be able to import each entry.

## 10. Add-ons

### 10.1 Cursor plugin (`magic-cursor-wand/cursor`)

1. The plugin is optional.
2. In `glow` mode (the default), the native cursor stays. The plugin adds a glow that follows the pointer.
3. In `replace` mode, the plugin hides the native cursor and shows the arrow. Over interactive elements and `ignoreSelector`, the native cursor shows again.
4. The option `render(element)` replaces the arrow.
5. The plugin hides the cursor for touch input and when the pointer leaves the window.

### 10.2 Settings panel (`magic-cursor-wand/panel`)

1. `panelModel(wand)` converts the schema to groups and controls. It has no dependency on a UI library.
2. `panelPlugin(options)` shows the model with Tweakpane 4. Tweakpane is an optional peer dependency.
3. The plugin loads Tweakpane only when the panel opens. The default loader is `() => import('tweakpane')`. The IIFE build loads Tweakpane from `https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js`.
4. The plugin instance controls the panel: `panel.open()`, `panel.close()` and `panel.toggle()`.
5. These triggers are optional and off by default: `hotkey`, `urlParam` and `launcher`.
6. The panel has the buttons Reset, Import and Export. It has no Save button, because autosave is always on.
7. A nullable color shows as an "inherit" checkbox and a color control.
8. The option `nonce` goes to the style element of Tweakpane.

### 10.3 React (`magic-cursor-wand/react`)

1. The entry exports `useWand(options, ref?)` only. React 18 or later is an optional peer dependency.
2. The hook reads `effects`, `plugins`, `providers` and `target` one time. To change them, remount the component with a new `key`.
3. The hook compares `config` for each section and calls `setConfig` when it changes.
4. The hook operates correctly in `StrictMode`.

### 10.4 Script tag build

1. The file `dist/magic-cursor-wand.iife.js` contains the core, the effects, all providers, the cursor plugin and the panel plugin. It does not contain React. The global name is `MagicCursorWand`.
2. If the script element has `data-wand-*` attributes, the build starts a wand automatically. Examples: `data-wand-config-url`, `data-wand-storage-key`, `data-wand-cursor`. If there are no attributes, the build does nothing.

## 11. Quality

### 11.1 Code

1. Write clean code that documents itself. Do not write comments that tell what the code does.
2. Exception: write TSDoc on each exported symbol. The summary is one STE sentence. Add `@param`, `@returns` and `@example` if they help.
3. `tsconfig.json` uses `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` and `isolatedDeclarations`. Give explicit return types to exported functions.
4. Biome does the lint and the format.

### 11.2 Tests

1. Put tests next to the source: `x.test.ts` runs in Node, `x.browser.test.ts` runs in the browser.
2. The browser project of Vitest runs on Chromium, Firefox and WebKit with Playwright.
3. Test the logic with a manual scheduler and a seeded random function.
4. Each effect has seeded pixel snapshot tests.
5. A leak test makes sure that `destroy()` removes all listeners, frames and observers.

### 11.3 Documentation

1. Write all prose in STE: `README.md`, `CONTRIBUTING.md`, `PLAN.md`, `docs/`, TSDoc and runtime messages.
2. Vale lints the prose with the project style `STE` in `.vale/styles/STE`. An error stops CI.
3. The STE style checks:
   - Sentence length: at most 20 words in a procedure, at most 25 words in a description.
   - Paragraph length: at most 6 sentences.
   - No passive voice, no `-ing` verb forms, no contractions, no phrasal verbs.
   - One instruction for each sentence, in the imperative.
   - The glossary of approved technical names.
   - A list of substitutions for words that STE does not approve.
4. The ASD-STE100 dictionary has a copyright. Do not copy it into the repository. A pull request checklist covers the rules that Vale cannot check.
5. The documentation site uses VitePress in `docs/`. It has these parts: Get started, Concepts, How-to, Reference, Troubleshooting. A how-to page contains one procedure.
6. TypeDoc with `typedoc-plugin-markdown` makes the API reference. A script makes the configuration tables from the schema metadata.
7. Code samples are in `docs/snippets/*.ts`. CI compiles them. The pages include them with `<<< @/snippets/file.ts#region`. An inline code block has at most 3 lines.
8. The documentation is in English only.

### 11.4 Tools and release

1. Use pnpm.
2. GitHub Actions run these checks: typecheck, lint, prose lint, tests (Node and browser), build, publint, attw, size-limit and snippet compilation.
3. The size limit for the core is 8 kB gzip.
4. Changesets controls versions and the changelog. The release workflow opens the pull request `chore: release`. When it merges, the workflow publishes to npm with trusted publishing and provenance.
5. GitHub Pages hosts the documentation site and the demo.
6. When a collaborator writes the comment `/publish` on a pull request, CI runs and a preview package goes to pkg.pr.new.

## 12. Changes to this plan

| Date | Change |
|---|---|
| 2026-09-26 | The panel plugin instance controls the panel (`panel.open()`), not `wand.panel`. This gives correct types without augmentation. |
| 2026-09-26 | Tests use the `scheduler` and `random` options, not a `step` method on the wand. |
| 2026-09-26 | The engine and the store are 8 kB gzip. The default effects add 6.5 kB. The size limit of the main entry with the default effects is 13 kB. The size limit of the React entry includes the core. |
| 2026-09-26 | The `theme` section is in `src/config/theme.ts`. The engine and the panel use it. |
| 2026-09-26 | The script tag build also accepts `data-wand-sse-url` and `data-wand-panel-hotkey`. |
| 2026-09-26 | `ConfigProvider.subscribe` gets a second, optional argument `onError`. The HTTP provider sends a poll that fails to it. The SSE provider sends a message that is not valid to it. The store emits a `provider` error. |
| 2026-09-26 | `PluginContext` has the function `reportError`. The panel sends the errors of Tweakpane loads and file imports to it, so the option `silent` also applies to plugins. |
| 2026-09-26 | A tap makes a chalk dot only if `shouldDraw` accepts it. A tap on a link or a button makes only a `burst` event. |
| 2026-09-26 | A pixel snapshot is a grid of the mean alpha of each 10 by 10 pixel cell, in `src/effects/__pixels__`. A test accepts a difference of at most 8 in each cell, so one snapshot is correct for Chromium, Firefox and WebKit. |
| 2026-09-26 | The cloud pixel snapshot accepts a difference of at most 14, because the cloud effect stacks many layers with low alpha. |
| 2026-09-26 | The workflows `release.yml` and `preview.yml` call `ci.yml`. A release or a preview starts only after CI passes. |
