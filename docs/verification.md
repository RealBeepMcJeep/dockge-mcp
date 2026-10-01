# Implementation verification

Local verification on 2026-09-30 uses Bun 1.4.2, MCP SDK 1.31.0, Socket.IO 4.8.4,
and MCP 2025-11-25. The compatibility profile comes from official Dockge tag
1.5.0, commit `bac498f97ffc33f7ffb2380bd68493de0719f4dd`.

- Strict TypeScript checks passed.
- 20 tests passed against a source-derived Socket.IO fixture and real MCP SDK
  HTTP client. Cases cover ACK/push ordering, endpoint isolation, independent
  environment permissions, preservation/revision conflicts, uncertain results,
  restart recovery, retention, authentication, schemas and bounded output.
- Linux x64 and arm64 executables compiled; the x64 executable passed an
  authenticated HTTP/MCP smoke with all 24 tool definitions.
- Actionlint 1.7.12 passed the public workflow.
- Bun dependency audit passed after upgrading YAML to 2.9.1 to avoid the
  deeply nested YAML denial-of-service advisory.

## Public CI and image evidence

The [first mirrored build](https://github.com/RealBeepMcJeep/dockge-mcp/actions/runs/36812911951)
passed for implementation commit `b82d36b53a98e55c385550caa60e8d5a2faf2884`:

- Native x64 and arm64 TypeScript/tests, executable builds and HTTP/MCP smoke.
- Both native Docker images, running as UID 10001 with a read-only filesystem,
  writable persistent state and HTTP/MCP smoke before and after restart.
- Actual pinned Dockge 1.5.0 with the runner's Docker engine, exercised through
  the MCP HTTP client: discovery, networks, conversion, draft creation, dedicated
  environment save/get, YAML/environment preservation, deploy, native lifecycle,
  finite logs, stopped-stack update and deletion.
- Multi-platform image publication and anonymous registry manifest access.

Published image: `ghcr.io/realbeepmcjeep/dockge-mcp:dev` (also tagged
`sha-b82d36b53a98e55c385550caa60e8d5a2faf2884`). Independently fetched without
credentials, its index contains Linux amd64 and arm64 plus build attestations.
Index digest: `sha256:bbf27fdf7c23b253a1b7f10dacd51a6a8c1742ae88d9ab2441a51e2808a7ea63`.

The GitHub package is already public; no manual visibility change was needed.
Compiled executables are workflow artifacts. Tagged release creation and binary
release assets have not been exercised yet. The successful build emitted Action
Node 20 deprecation notices; update those pinned Actions to Node 24 releases in
the next workflow maintenance pass.

This workspace still has no Docker engine or arm64 execution capability. Docker
and native arm64 evidence above comes from public runners. No production Dockge
URL or credentials were used. Agent routing/failure scenarios are tested in
fixtures; the real upstream job currently exercises a single primary.

The user's live Dockge/hub deployment remains unverified. Before enabling writes,
verify the actual release image/source fingerprint, authentication, registered
agent topology and read-only tool calls. Then use disposable stacks for mutation
acceptance. This project does not provision or alter the user's homelab deployment.
