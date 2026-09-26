# Obey a strict CSP

Use this procedure on a site with a strict Content Security Policy (CSP). The core and the effects need no changes to the policy, because they set styles with `element.style` only.

## Procedure

1. Make sure that your policy lets the page load the package script.
2. If you use the settings panel, give the nonce of the page to the `nonce` option:

   <<< @/snippets/strict-csp.ts#nonce

3. If you use the script build with the panel, add `https://cdn.jsdelivr.net` to `script-src`.
4. Open the page and the browser console. Make sure that the console shows no CSP errors.

## Result

The panel plugin gives the nonce to the style element of Tweakpane. The library makes no network requests for images.
