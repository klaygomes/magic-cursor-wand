---
layout: home

hero:
  name: magic-cursor-wand
  text: Chalk, glitter and cloud effects for the pointer
  tagline: A small browser library. Add effects, plugins and configuration providers without changes to the core.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: See the demo
      link: https://klaygomes.github.io/magic-cursor-wand/examples/

features:
  - title: Three effects
    details: The cloud, chalk and glitter effects follow the pointer. Each effect has a schema with safe limits.
  - title: Configuration from providers
    details: Get the settings from localStorage, an HTTP endpoint or a server event stream. Autosave is always on.
  - title: Strict CSP
    details: The library sets styles with element.style only. It makes no network requests for images.
  - title: Reduced motion
    details: The wand obeys the prefers-reduced-motion media query. The site owner can also stop all motion.
---

## What the library does

The library shows chalk, glitter and cloud effects that follow the pointer. A fixed canvas covers the viewport, and the page below the canvas continues to receive clicks.

The core has no dependencies. The settings panel uses Tweakpane, and the hook for React uses React. Both are optional.

## Where to start

- To add the effects to a page, read [Get started](/guide/getting-started).
- To learn how the parts operate together, read the [concepts](/concepts/surface).
- To do one specified task, read a [how-to page](/how-to/use-script-tag).
- To find the name and type of an option, read the [reference](/reference/).
