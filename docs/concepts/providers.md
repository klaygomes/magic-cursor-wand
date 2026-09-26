# Providers

A provider gives configuration documents to the wand. A provider can also save documents and send changes. All providers are in the entry `magic-cursor-wand/providers`.

## Built-in providers

| Provider | Load | Save | Changes |
|---|---|---|---|
| `staticProvider(document)` | Returns the document | No | No |
| `localStorageProvider({ key })` | Reads the key | Writes the key | The `storage` event from other tabs |
| `httpProvider({ url })` | One GET request | PUT or POST, if you set `save` | Polls with ETag, if you set `pollMs` |
| `eventSourceProvider({ url })` | The first message | No | Each message |
| `compositeProvider(name, providers)` | Merges the documents in sequence | Sends the document to each writable provider | Merges the changes |

## Slots and precedence

Each provider has one slot. When the result of a provider arrives, the wand puts it in the slot and merges all layers again. Thus a slow provider with low precedence cannot override a fast provider with high precedence.

The wand starts at once with the schema defaults and the `config` option. It does not wait for the providers. To wait for the providers before the first frame, set `startAfter: 'ready'`.

The promise `wand.ready` resolves after all providers settle. It never rejects. If a provider fails, the wand emits a `provider` error and continues.

## Requests and cancellation

The `httpProvider` accepts one static `headers` object. The `EventSource` API cannot send headers, so the `eventSourceProvider` sends cookies with `withCredentials`.

The HTTP provider stops the polls while the page is not visible. When you call `destroy`, the wand stops all open requests.

## Your own provider

A provider is an object with a `name` and a `load` function. The functions `save` and `subscribe` are optional. For a procedure, read [Write a provider](/how-to/write-a-provider).
