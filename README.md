<p align="center">
  <img src="https://www.estacouveflor.com/magic-cursor-wand/wand.svg" width="220" alt="A chalk line with glitter that follows a pointer">
</p>

<h1 align="center">magic-cursor-wand</h1>

<p align="center">
  <strong>Give your pointer a wand.</strong><br>
  Chalk lines, glitter and soft clouds that follow the pointer on any web page.
</p>

<p align="center">
  <a href="https://www.estacouveflor.com/magic-cursor-wand/examples/"><strong>Try the live demo</strong></a>
  &nbsp;|&nbsp;
  <a href="https://www.estacouveflor.com/magic-cursor-wand/">Documentation</a>
  &nbsp;|&nbsp;
  <a href="https://www.npmjs.com/package/magic-cursor-wand">npm</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/magic-cursor-wand"><img src="https://img.shields.io/npm/v/magic-cursor-wand?color=7e23b3" alt="npm version"></a>
  <a href="https://github.com/klaygomes/magic-cursor-wand/actions/workflows/release.yml"><img src="https://img.shields.io/github/actions/workflow/status/klaygomes/magic-cursor-wand/release.yml?branch=main&label=checks" alt="Checks"></a>
  <a href="LICENSE"><img src="https://img.shields.io/npm/l/magic-cursor-wand?color=c63f75" alt="MIT license"></a>
</p>

## One line of code, a page that feels alive

```ts
createWand();
```

[![The demo page with a chalk line and the settings panel](https://www.estacouveflor.com/magic-cursor-wand/demo.jpg)](https://www.estacouveflor.com/magic-cursor-wand/examples/)

## Why use it

- **Small and fast.** The core has no dependencies. The canvas sleeps when nothing moves, and each effect has a limit for its particles.
- **Safe on strict pages.** The library sets styles with `element.style` only and makes no network requests. It operates with a strict Content Security Policy.
- **You control each value.** Each effect has a schema with safe limits. Change the values in code, or let visitors change them in a settings panel.
- **Settings from any source.** Get the settings from `localStorage`, an HTTP endpoint or a server event stream. The wand saves each change automatically.
- **Open for your own ideas.** Effects, plugins and providers are small objects. Add your own without a change to the core.
- **Kind to each visitor.** Set `theme.motion` to `auto`, and the wand obeys `prefers-reduced-motion`.

## Start in one minute

### With a bundler

```sh
npm install magic-cursor-wand
```

```ts
import { createWand } from 'magic-cursor-wand';

const wand = createWand();
```

To remove the canvas and all listeners, call `wand.destroy()`.

### With a script tag

Add this element to the end of the `body` element. No bundler is necessary:

```html
<script
  src="https://cdn.jsdelivr.net/npm/magic-cursor-wand@0.2.0/dist/magic-cursor-wand.iife.js"
  integrity="sha384-XxBXqYPuFEcQp51OYVOK/CslqB4ooezSzEvohIGISSD4E7Gxi3IOg09R3e/wKmF5"
  crossorigin="anonymous"
  data-wand-storage-key="my-site-wand"
  data-wand-cursor="glow"
></script>
```

The `integrity` attribute makes sure that the browser runs only the published file.

### With React

```tsx
import { useWand } from 'magic-cursor-wand/react';

export function Page() {
  useWand({ config: { chalk: { size: 20 } } });
  return <main>My page</main>;
}
```

The hook removes the wand when React removes the component.

## Make it yours

```ts
createWand({
  config: {
    theme: { color: '#7e23b3' },
    chalk: { size: 20, taper: 0.5 },
    glitter: { spawnRate: 6 },
  },
});
```

All fields and their limits are in the [configuration reference](https://www.estacouveflor.com/magic-cursor-wand/reference/configuration). To tune the values by eye, open the [demo](https://www.estacouveflor.com/magic-cursor-wand/examples/), move the sliders, and export the result.

## Documentation

- [Get started](https://www.estacouveflor.com/magic-cursor-wand/guide/getting-started)
- [Concepts](https://www.estacouveflor.com/magic-cursor-wand/concepts/surface)
- [How-to pages](https://www.estacouveflor.com/magic-cursor-wand/how-to/use-script-tag)
- [Configuration reference](https://www.estacouveflor.com/magic-cursor-wand/reference/configuration)
- [API reference](https://www.estacouveflor.com/magic-cursor-wand/reference/api/)
- [Troubleshooting](https://www.estacouveflor.com/magic-cursor-wand/troubleshooting)

## Supported browsers

Chrome and Edge 88, Firefox 85, Safari and Safari on iOS 14.5, and later versions.

## Contribute

Read [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
