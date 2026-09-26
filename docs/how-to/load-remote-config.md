# Load a remote configuration

Use this procedure to get the settings from a server. The server can change the settings for all visitors.

## Procedure

1. Put a configuration document on your server, for example at `/api/wand.json`.
2. Make sure that the document has the format `{ "v": 1, "<section>": { ... } }`.
3. Import `httpProvider` from `magic-cursor-wand/providers`.
4. Add the provider to the `providers` option:

   <<< @/snippets/remote-config.ts#http

5. Open the page. Make sure that the effects use the values from the server.

## Result

The provider sends one GET request when the wand starts. If you set `pollMs`, the provider sends a request again at this interval. It uses ETag and `If-None-Match`, so an unchanged document costs a small response only.

In the example, `startAfter: 'ready'` delays the first frame until the providers settle. To wait for the providers in your own code, use `wand.ready`:

<<< @/snippets/remote-config.ts#ready

To let the page save to the server, set `save: 'PUT'` or `save: 'POST'`.
