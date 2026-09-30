# TypeScript with Bun

Selected by the owner on 2026-09-30. Bun was not found on the local PATH; no
installation or runtime spike has been performed during the design interview.

The maintained SDK v1
[WebStandardStreamableHTTPServerTransport](https://github.com/modelcontextprotocol/typescript-sdk/blob/v1.x/src/server/webStandardStreamableHttp.ts)
explicitly supports Bun and exposes a Request-to-Response handler that can be
mounted on `Bun.serve`. This avoids needing Express or a Node HTTP adaptation
layer. Use the accepted MCP 2025-11-25 baseline, not an assumed SDK v2 migration.

The official [Socket.IO transport table](https://socket.io/docs/v4/client-options/#transports)
documents compatible Bun transports including Fetch, NodeXHR, NodeWebSocket,
and native WebSocket. Use the official client with native positional events and
ACK callbacks. Validate package exports, polling/WebSocket upgrade, login/JWT
reconnect, agent routing, and interleaved terminal events under Bun.

Read-only metadata research found Bun 1.4.2,
[@modelcontextprotocol/sdk 1.31.0](https://registry.npmjs.org/@modelcontextprotocol/sdk/1.31.0),
and [socket.io-client 4.8.4](https://github.com/socketio/socket.io/releases/tag/socket.io-client@4.8.4).
These are implementation candidates, not installed/tested dependencies. Pin
tested releases and commit the Bun lockfile once implementation starts.

[Bun SSE guidance](https://bun.com/guides/http/sse) discusses connection idle
timeouts. Validate streamed MCP responses and cleanup with the homelab hub;
the default HTTP idle timeout can interrupt long-lived response streams.

[Bun's compile mode](https://bun.com/docs/bundler/executables) can package imported
code and the runtime into an executable. This preserves an optional single-file
distribution without requiring a separately installed Bun runtime, but platform,
TLS, and configuration loading must be tested before making portability claims.

[Built-in SQLite](https://bun.com/docs/runtime/sqlite) offers an operation-ledger
option without adding a separate database service or an npm SQLite driver.
Persistence/retention were subsequently accepted in round 4 and recorded in ADR
0006.
