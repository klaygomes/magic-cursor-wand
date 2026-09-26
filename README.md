# magic-cursor-wand

Chalk, glitter and cloud effects that follow the pointer in a web browser.

- The core has no dependencies. The engine and the store are 8 kB with gzip. The default effects add 6.5 kB.
- You can add effects, plugins and configuration providers without changes to the core.
- The wand gets its settings from `localStorage`, from an HTTP endpoint or from a server event stream.
- The library sets styles with `element.style` only. Thus it operates with a strict Content Security Policy.
- The wand obeys `prefers-reduced-motion`.

[Documentation](https://klaygomes.github.io/magic-cursor-wand/) | [Demo](https://klaygomes.github.io/magic-cursor-wand/examples/) | [API reference](https://klaygomes.github.io/magic-cursor-wand/reference/api/)

## Install

```sh
pnpm add magic-cursor-wand
```

You can also use npm or Yarn. The settings panel needs Tweakpane 4, and the hook needs React 18 or later. Both are optional.

## Quick start with a bundler

Import `createWand` and call it one time:

```ts
import { createWand } from 'magic-cursor-wand';

const wand = createWand();
```

The wand attaches a fixed canvas above the page. The canvas does not stop clicks. To remove the canvas and all listeners, call `wand.destroy()`.

## Quick start with a script tag

Add the script element to the end of the `body` element:

```html
<script
  src="https://cdn.jsdelivr.net/npm/magic-cursor-wand/dist/magic-cursor-wand.iife.js"
  data-wand-storage-key="my-site-wand"
  data-wand-cursor="glow"
></script>
```

The `data-wand-*` attributes start a wand automatically. Without these attributes, use the global `MagicCursorWand`.

## Quick start with React

Call the hook `useWand` in a component:

```tsx
import { useWand } from 'magic-cursor-wand/react';

export function Page() {
  useWand({ config: { chalk: { size: 20 } } });
  return <main>My page</main>;
}
```

The hook destroys the wand when React removes the component.

## Documentation

- [Get started](https://klaygomes.github.io/magic-cursor-wand/guide/getting-started)
- [Concepts](https://klaygomes.github.io/magic-cursor-wand/concepts/surface)
- [How-to pages](https://klaygomes.github.io/magic-cursor-wand/how-to/use-script-tag)
- [Configuration reference](https://klaygomes.github.io/magic-cursor-wand/reference/configuration)
- [Troubleshooting](https://klaygomes.github.io/magic-cursor-wand/troubleshooting)

## Supported browsers

Chrome and Edge 88, Firefox 85, Safari and Safari on iOS 14.5, and later versions.

## Contribute

Read [CONTRIBUTING.md](CONTRIBUTING.md). All prose in this project obeys ASD-STE100 Simplified Technical English.

## License

MIT
