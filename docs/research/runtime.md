# Runtime comparison: Rust and TypeScript

Research on 2026-09-30 for Q12. No runtime has been selected, no toolchain has
been installed, and no implementation spike has been run. The owner prefers a
single-file executable and few installed dependencies.

## Rust fits the packaging preference

The [official Rust MCP SDK](https://github.com/modelcontextprotocol/rust-sdk)
provides Tokio-based server support. Its documented protocol compatibility
includes the hub's 2025-11-25 baseline. Published
[rmcp 3.5.0](https://docs.rs/crate/rmcp/3.5.0) has a Streamable HTTP server feature;
the legacy session behavior still needs an integration check against our hub.

Rust compiles application dependencies into an executable. A standalone binary
with few installed runtime dependencies is a reasonable target; a tiny source
dependency graph is a separate goal and is not implied. HTTP, MCP, JSON/schema,
async runtime, Socket.IO, and TLS all require libraries. Docker can wrap the same
binary for the accepted initial deployment rather than being its only delivery
format. Supported Node and npm are available locally; Rust/cargo were not found
on PATH during the read-only environment check.

## Socket.IO is the main uncertainty

[rust_socketio 0.6.0](https://docs.rs/rust_socketio/0.6.0/rust_socketio/)
supports Socket.IO revision 5/Engine.IO revision 4, matching Socket.IO 3/4 wire
formats. Its features include polling/WebSocket, request ACK callbacks, positional
event arguments, and reconnect configuration. The async API is experimental.
Published 0.6.0 is from 2024; do not assume a source branch is the published crate.

[Published async client source](https://docs.rs/crate/rust_socketio/0.6.0/source/src/asynchronous/client/client.rs)
shows risks requiring explicit validation: ACK IDs are selected from a small
random range without collision protection; sending with ACK does not itself
await the response; timeout handling does not provide a normal awaited timeout
result; and callbacks run while internal locks are held. Adapter callbacks should
forward data to channels rather than issue nested awaited requests. Fixes or a
different client may be necessary before adopting it.

Dockge's agent envelopes and multiple positional arguments are representable
using [Payload::Text](https://github.com/1c3t3a/rust-socketio/blob/main/socketio/src/payload.rs).
Passing one JSON array as a payload is not necessarily the same as sending
several positional arguments. This needs a fixture test, including wrapped ACK
response arrays and terminal events interleaved with commands.

The newer [sioc client](https://github.com/Stanley5249/sioc-rs) offers awaitable
ACKs and typed payloads, but its README states early development and incomplete
JavaScript conformance testing. It is a candidate for evaluation, not established
production support.

## Single-file does not automatically mean static

The examined Socket.IO client depends on
[native-tls](https://docs.rs/native-tls/latest/native_tls/), which uses OpenSSL
on Linux. A default binary can require system libraries. Vendored OpenSSL and a
musl target can support static packaging, but build configuration, architectures,
and HTTPS certificate handling must be verified before claiming portability.
See [OpenSSL build requirements](https://docs.rs/openssl/latest/openssl/).

## TypeScript comparison

TypeScript uses the same
[official Socket.IO client](https://socket.io/docs/v4/client-api/)
as Dockge and has fewer integration uncertainties. Its maintained MCP SDK v1
supports the current hub baseline. Deployment requires Node or a packaging
strategy that embeds it; a container hides the install steps but does not remove
the runtime. That conflicts with the owner's preferred standalone distribution.

## Proposed choice and validation

Given the owner's preference, propose Rust with a standalone executable and a
Docker image wrapping it. The first implementation milestone should prove
Dockge login/JWT reconnect, agent routing, ACK correlation/timeouts, interleaved
logs, and MCP 2025-11-25 compatibility using isolated fixtures. Also prove the
binary's runtime/library requirements. A failed spike should reopen the client
or runtime decision, rather than silently changing languages or hand-writing an
unverified Socket.IO implementation.
