# Use React

Use this procedure to start a wand from a React component. The hook `useWand` needs React 18 or later.

## Procedure

1. Import `useWand` from `magic-cursor-wand/react`.
2. Call `useWand` in the component that shows the page:

   <<< @/snippets/react-page.tsx#page

3. To draw in one element only, give a ref as the second argument:

   <<< @/snippets/react-container.tsx#container

4. Start the application and move the pointer. Make sure that the effects follow the pointer.

## Result

The hook starts the wand when React adds the component to the page. The hook destroys the wand when React removes the component.

## Rules for the options

- The hook reads `effects`, `plugins`, `providers` and `target` one time. To change them, give the component a new `key`.
- The hook compares `config` for each section. When a section changes, the hook calls `setConfig`.
- The hook operates correctly in `StrictMode`.
