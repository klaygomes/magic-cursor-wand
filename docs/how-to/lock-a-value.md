# Lock a value

Use this procedure to stop the providers and the settings panel from a change to a value. For example, lock the performance limits on a slow site.

## Procedure

1. Put the value that you want in the `config` option.
2. Add the path of the value to the `locked` option:

   <<< @/snippets/lock.ts#lock

3. Open the settings panel and change the locked value.
4. Load the page again. Make sure that the value is equal to the value in `config`.

## Result

The wand removes the locked paths from each provider layer and from the runtime layer. Only the schema defaults and the `config` option can set a locked value.

A path has the format `<section>.<field>`, for example `glitter.maxParticles`.
