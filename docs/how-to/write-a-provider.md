# Write a provider

Use this procedure to get the settings from a source that the built-in providers do not support. The example provider uses `sessionStorage`.

## Procedure

1. Write a function that returns an object of the type `ConfigProvider`.
2. Give the object a unique `name`.
3. Write a `load` function that returns a configuration document or `null`.
4. Optional: write a `save` function that writes the document.
5. Optional: write a `subscribe` function that sends changes from the source.
6. Give the provider to `createWand` in the `providers` option:

   <<< @/snippets/custom-provider.ts#register

## Example

This provider has a `load` function and a `save` function:

<<< @/snippets/custom-provider.ts#provider

## Result

The wand calls `load` one time and puts the result in the slot of the provider. If the provider has a `save` function and is the last writable provider, autosave writes to it.

## Rules for providers

- Return `null` from `load` when the source has no document.
- Use the `AbortSignal` argument of `load` for network requests. The wand stops the signal on `destroy`.
- Do not throw an error for an unavailable source. Return `null`, or let the wand catch the error and emit a `provider` error.
- Return the full document from each change. The wand replaces the slot, so a lost change does not cause a permanent difference.
