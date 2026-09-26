# Events

The wand has two types of events. Lifecycle events go from the wand to your code. Bus events go between effects and plugins.

## Lifecycle events

| Event | Payload | When |
|---|---|---|
| `config` | `{ next, previous }` | After each change to the merged configuration. |
| `error` | `{ kind, source, message, cause }` | When a provider, a field or an effect has a problem. |
| `ready` | None | After all providers settle. |

To listen for an event, call `wand.on`. The function returns a second function that removes the listener.

<<< @/snippets/events.ts#lifecycle

<<< @/snippets/events.ts#config

## Errors

After `createWand` returns, the wand does not throw errors. It emits `error` events. The value of `kind` is `provider`, `validation` or `effect`.

The default listener writes one `console.warn` message for each different source. To stop these messages, set `silent: true`.

## Bus events

An effect or a plugin gets the event bus in its context. A bus event tells an intent, not a source. For example, the chalk effect emits `burst { x, y, strength }`, and the glitter effect listens for it.

Dispatch is synchronous. Do not keep a reference to a payload object after the handler returns, because the wand can use the object again.

## Your own events

To add an event type, add a member to the interface `WandEvents` with module augmentation:

<<< @/snippets/plugin.ts#augment
