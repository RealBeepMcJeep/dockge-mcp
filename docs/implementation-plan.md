# Implementation plan

Initial implementation and public CI passed under the accepted design. Gitea and its
public GitHub mirror are configured; no mirror PAT is needed in the workspace.
See verification.md for completion evidence. Live homelab access is deferred.

## Confirmed execution constraints

The owner cannot provide live Dockge access now. This workspace has no Docker or
Podman executable, Docker socket, or configured Docker host. Node/npm and Gitea
access are available; Bun can be installed for local implementation. Public npm
metadata and Bun release downloads are reachable. GitHub Actions can build from the configured public mirror.

Validate locally using source-pinned Socket.IO fixtures, real MCP clients, and
fault injection for ACK ordering/loss, reconnects, permissions, revision races,
and durable recovery. This verifies the adapter contract and logic, not actual
Docker/Compose behavior. After GitHub access is configured, Ubuntu Actions jobs
can run disposable Dockge 1.5.0 with a Docker engine for actual upstream
integration and image checks. No production Dockge access is needed for those
tests. Exact homelab compatibility remains a later deployment check.

## 1. Runtime and protocol foundation

- Scaffold TypeScript/Bun with pinned SDK v1 and official Socket.IO client,
  frozen lockfile, type checks, and meaningful tests.
- Expose private Streamable HTTP with bearer authentication, origin/host checks,
  bounded sessions/requests, and explicit MCP 2025-11-25 compatibility.
- Implement Dockge Socket.IO login/JWT reconnect and positional agent envelopes.
  Use isolated fixtures to verify ACK correlation, timeouts, and push ordering.
- Declare official Dockge 1.5.0 support using a profile, not just its reported
  version string. Never infer mutation support by sending a test mutation.

## 2. Operations and domain tools

- Implement endpoint-qualified discovery, YAML/configuration reads, status,
  bounded logs, networks, and Docker-run conversion.
- Implement faithful create/edit/deploy/lifecycle/delete semantics, revision
  checks, and one mutation at a time per agent/stack.
- Persist operation handles/guards in Bun SQLite, with bounded logs retained
  24 hours and explicit unknown-outcome recovery. No automatic replay.
- Add separate environment-get/environment-set tools and independently disabled
  read/write permissions. Preserve untouched documents internally and verify
  saves, without promising atomic protection against external UI edits.
- Keep shells, master-only service lifecycle/stats, broader Docker management,
  and per-person identity work on the deferred list.

## 3. Packaging and public build workflows

- Build/test the Docker image and compiled Bun executables on Linux x64/arm64;
  include checksums and source/revision/version metadata.
- Prepare CI-gated GitHub Actions following the newer public repo examples:
  frozen installs, type/tests, image/binary builds, HTTP/MCP smoke, minimal job
  permissions, pinned actions, and caching.
- Publish dev/commit images from trusted main pushes and versioned images plus
  binaries from release tags. Promote latest only for validated stable releases.
- Verify public registry visibility and anonymous pulls after package setup.

## 4. Configure external integrations

- With GitHub access, create public `realbeepmcjeep/dockge-mcp`, configure Gitea's
  one-way push mirror, and publish `ghcr.io/realbeepmcjeep/dockge-mcp`.
- With live Dockge configuration, verify authentication, actual release/profile,
  registered-agent discovery, and read-only calls through the homelab hub.
- Verify mutations against disposable stacks. Production stacks are not test
  fixtures. Deployment is a separate action from creating build/release artifacts.

Repository creation and push mirroring are complete. GHCR publishing uses
Actions-generated GITHUB_TOKEN; first-publication package visibility may still
need owner configuration. No production credentials are required for CI.

## Completion evidence

Report implemented tool schemas/permissions, focused test results, tested
protocol/Dockge versions, image/binary build and smoke results, public repository
and image links when available, and any concrete external-configuration gaps.
Keep all design/verification records current as implementation reveals facts.
