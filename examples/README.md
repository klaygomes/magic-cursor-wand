# Examples

This directory contains the demo pages of magic-cursor-wand:

| Page | Contents |
|---|---|
| `index.html` | Overlay mode on a chalkboard, the cursor plugin in `replace` mode, the settings panel with a launcher and a localStorage provider. |
| `container.html` | Container mode. The wand draws only in one element. |
| `script-tag.html` | The script tag build with `data-wand-*` attributes. |

To start the demo pages on your computer, run these commands:

```sh
pnpm build
pnpm dev
```

The script tag page uses the files in `dist`. Thus you must build the package before you open that page.

The GitHub Pages workflow builds the demo pages and puts them at `/magic-cursor-wand/examples/`.
