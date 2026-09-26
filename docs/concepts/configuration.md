# Configuration

The configuration of a wand is a set of sections. Each effect and each plugin is a section. The core owns one more section, `theme`.

## Sections and fields

A section has a name and a schema. The schema is a list of fields. Each field has a label, a description, a default value and a parse function.

| Field builder | Values |
|---|---|
| `field.number` | A number between `min` and `max`. The field rounds the value to `step`. |
| `field.color` | A color in the format `#rrggbb`. A nullable color also accepts `null`. |
| `field.boolean` | `true` or `false`. |
| `field.enum` | One value from the list `options`. |

Each section also gets the field `enabled`. The default value is `true`.

A nullable color with the value `null` gets the value of `theme.color`. Thus you can change the color of all effects with one field.

The [configuration reference](/reference/configuration) shows all sections and fields.

## Layers

The wand merges the settings from these layers. A later layer overrides an earlier layer, field by field.

1. The schema defaults.
2. The `config` option.
3. Each provider, in the order of the `providers` option.
4. The runtime layer, from `setConfig`.

<<< @/snippets/configuration.ts#defaults

The `locked` option removes paths from the provider layers and from the runtime layer. Thus a provider or a user cannot change a locked value.

## Change the settings at runtime

Call `setConfig` with the changes. The wand merges the changes into the runtime layer.

<<< @/snippets/configuration.ts#runtime

## Autosave

Autosave is always on. After `setConfig`, the wand waits for the time in `autosaveDebounceMs` and then saves. The default time is 500 milliseconds.

The wand saves to the last provider that has a `save` function. The saved document contains only the difference from the layers below that provider. After a save, the runtime layer becomes empty.

A change that comes from a provider never starts a save. This rule prevents loops between browser tabs or between a client and a server.

## Document format

The wand reads and writes configuration documents in one fixed format:

```json
{ "v": 1, "chalk": { "size": 20 } }
```

The wand ignores values that are not valid and emits a `validation` error. The wand keeps sections that it does not know. Thus a remote document can contain settings for an effect that the page does not load.

<<< @/snippets/configuration.ts#document

To remove the saved difference and clear the runtime layer, call `reset`.
