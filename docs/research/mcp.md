# MCP server guidance

Verified against official documentation on 2026-09-30. Recommendations below are
inputs to the design interview, not accepted project decisions.

## Current protocol and SDK

The [latest specification](https://modelcontextprotocol.io/specification/latest)
resolves to [2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28).
The [official TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
describes v2 as stable, with split `@modelcontextprotocol/server` and
`@modelcontextprotocol/client` packages. v1 receives fixes/security updates for
at least six months following v2's release. Exact package patch versions were
not selected or installed during research. Pin the selected release and lockfile
when implementation starts.

SDK choice must follow the actual target clients' capabilities. Older tutorials
may describe v1 initialization, HTTP sessions, and GET streams that differ from
the current revision. Verify the homelab hub and clients before choosing the
compatibility baseline. Use the SDK rather than implementing JSON-RPC or
transport negotiation by hand.

## Observed homelab compatibility

Read-only discovery on 2026-09-30 identified the configured MCPHub dashboard as
the [samanhappy/mcphub](https://github.com/samanhappy/mcphub) software family.
The existing Codex-configured `/mcp/paseo-pi` route accepted initialization with
MCP 2025-11-25 and negotiated down to that version when 2026-07-28 was requested.
It returned a session header. The configured `/mcp/claude` route was not usable
with environment credentials during discovery; results apply to the tested
route, not every possible hub route.

The returned serverInfo identifies an upstream name/version and does not prove
the installed MCPHub application version. No application version was confirmed.
Recommendation for this deployment: target the tested 2025-11-25 baseline using
the maintained SDK v1 line initially, then verify actual tool calls through the
hub. Current v2/new-spec guidance above remains relevant for future upgrades,
but should not be assumed compatible with this deployment today.

Discovery used configured credentials without printing or copying their values
into the project. Only read-only initialization/health checks were performed.

## Transport

[Stdio](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio)
fits a bridge launched by a local client. Send diagnostics to stderr; stdout
belongs exclusively to protocol messages. Supply downstream credentials via
environment/configuration.

[Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
fits a persistent homelab container. The current revision uses one POST endpoint
with JSON or request-scoped SSE responses and removes the old GET stream and
protocol-level sessions. Validate Origins, reject invalid present origins, and
restrict local-only listeners to loopback. A container listener may need to bind
to its container interface; network exposure and authentication must be explicit
deployment choices.

Do not assume that a hub advertising "Streamable HTTP" implements the newest
revision. Establish a tested compatibility matrix, including the client versions
we actually use.

## Tools and results

The [tools specification](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)
supports input/output schemas and structured results. Describe target identity,
side effects, prerequisites, and completion criteria precisely. Return schema-
matching `structuredContent` plus useful text for clients that consume text.
Use `isError: true` for tool execution failures; reserve JSON-RPC errors for
protocol failures such as an unknown tool or malformed message.

Proposals for this project: every mutation identifies its agent and stack;
results distinguish command completion, readiness, and uncertain outcomes.
Avoid a vague `status` result that conflates bridge health, Dockge connectivity,
agent connectivity, and stack/container health.

[Tool annotations](https://modelcontextprotocol.io/specification/2026-07-28/schema#toolannotations)
help clients understand behavior but do not enforce permissions. Mark genuinely
read-only tools accordingly. Be conservative about destructive and idempotent
claims: restart causes repeated disruption, update pulls mutable image tags,
and Dockge start can recreate containers/remove orphans. Authorize effects and
targets in server code independently of these hints.

## Long-running operations

The [Tasks extension](https://modelcontextprotocol.io/extensions/tasks/overview)
is opt-in and requires explicit client support. Ordinary tools returning an
`operation_id`, with `operation_status` and `operation_logs`, are a candidate
fallback for slow pull/deploy operations. Task support could be added later.
Decide retention, expiration, persistence, and caller ownership of handles.

[Progress](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/progress)
is sent when the caller provides a progress token. Keep progress values
monotonic and describe meaningful phases. Docker CLI output is not a reliable
percentage of completion.

[Cancellation](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/cancellation)
is cooperative. Current HTTP uses closure of an SSE response stream; stdio uses
a cancellation notification. Canceling a request cannot be represented as
rollback or guaranteed termination of a Compose command already dispatched to
Dockge. Reconnect/timeouts must preserve unknown outcomes and avoid blind
mutation retries.

## Authentication and data boundaries

[MCP authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/index)
and [security guidance](https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices)
separate MCP-client credentials from downstream credentials. A network service
must have an explicit authentication boundary; decide whether it is enforced by
the server, hub, or both. A remote OAuth deployment uses protected-resource
metadata/discovery and audience/scope validation. Do not forward an MCP bearer
token to Dockge as if it were a Dockge JWT.

Project proposals: configure read/write/delete/exec capabilities, enforce target
restrictions per call, redact secrets from diagnostics, and audit operations
without retaining credentials or complete log payloads. Treat Compose files,
labels, logs, and command output as external data, never as model instructions.

## Output and execution contracts

Application-level bounds should limit logs/command output by bytes, lines,
duration, and cursor or pagination. Include truncation and freshness metadata.
Dockge's PTY logs are not structured stdout/stderr and do not provide arbitrary
historical ranges. Do not advertise filters the backend cannot fulfill.

An execution tool should have an explicit target, command representation,
timeout/output limits, completion status, and exit code where available. Bash
may not exist. Persistent shells require application-level session handles,
expiration, polling, and close semantics. Dockge's globally shared service shell
does not supply isolated finite exec results; capability design must account for
that rather than wrapping it as a trustworthy one-shot command tool.

## Verification once implemented

Use the [official Inspector](https://modelcontextprotocol.io/docs/2026-07-28/tools/inspector)
and SDK clients for discovery, schema/result validation, errors, bounded output,
timeouts, cancellation, and supported transports/protocol versions. Test the real
hub/client path before claiming compatibility. Dockge integration tests should
cover event ordering, reconnection/authentication, duplicate stack names across
agents, mutation ambiguity, partial deploy failures, and source-pinned protocol
fixtures. Run live mutation checks against disposable test stacks.
