# Get live updates

Use this procedure to send new settings from a server to all open pages. The provider uses server-sent events (SSE).

## Procedure

1. Make an endpoint on your server that sends an event stream.
2. Send a full configuration document in each message.
3. Import `eventSourceProvider` from `magic-cursor-wand/providers`.
4. Add the provider to the `providers` option:

   <<< @/snippets/live-updates.ts#sse

5. Send a new document from the server. Make sure that the page changes the effects.

## Result

The first message gives the first document. Each new message replaces the slot of the provider. Thus a lost message does not cause a permanent difference.

The `EventSource` API cannot send headers. To send cookies for authentication, set `withCredentials: true`.

A change from a provider never starts a save. Thus the page does not send the change back to the server.
