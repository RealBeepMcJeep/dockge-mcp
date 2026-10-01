# Dockge MCP

A TypeScript/Bun MCP server for **official Dockge 1.5.0**, using its authenticated
Socket.IO protocol. It exposes 24 tools for stack discovery, saved configuration,
lifecycle operations, service observations, finite logs and durable operation
tracking. The bridge connects remotely and does not need a Docker socket.

This is an initial implementation. The reported Dockge version alone does not
identify its build: released 1.5.0 and development source expose different
behavior. Configure against the official release, and verify your homelab
instance before enabling writes. See [verification](docs/verification.md).

## Run

Copy `.env.example` to `.env`, configure your Dockge URL and credentials, and
generate a separate MCP bearer token, for example `openssl rand -hex 32`.
Ordinary writes, deletion, environment reads and environment writes are all
disabled by default and independently enabled through configuration.

```sh
cp .env.example .env
# Edit .env before starting. The image is published after successful GitHub CI.
docker compose up -d
```

For a local source build, run `docker compose up -d --build`. To run from source
with Bun 1.4.2, use `bun install --frozen-lockfile` and `bun start`. Bun loads `.env`
automatically; compiled executables should receive configuration as process
environment variables. For local source execution set `STATE_DIR=./data`.

Connect your MCP hub/client to `http://<bridge>:3000/mcp` using
`Authorization: Bearer <MCP_BEARER_TOKEN>`. Add the exact host and port used by
the hub to `MCP_ALLOWED_HOSTS`; retain `127.0.0.1:3000` for image health checks.
Browser clients also need an exact `MCP_ALLOWED_ORIGINS` entry. No browser CORS
preflight is implemented initially; the supported client is a server-side hub.
The Compose example binds the listener to the host's loopback address; adjust
networking deliberately for your hub. Use a trusted private network or HTTPS
termination for credentials.

`/healthz` reports the bridge listener only. Use the authenticated `status` tool
for downstream connectivity and permissions. A running bridge can report Dockge
offline without failing its own listener health check.

## Tools and permissions

| Area | Tools |
| --- | --- |
| Discovery/observations | `status`, `list_agents`, `list_stacks`, `scan_stacks`, `stack_status`, `list_services`, `list_networks` |
| Configuration/logs | `get_stack`, `stack_logs`, `compose_from_docker_run` |
| Stack writes | `create_stack`, `edit_stack`, `deploy_stack`, `start_stack`, `stop_stack`, `restart_stack`, `update_stack`, `down_stack` |
| Deletion | `delete_stack` |
| Separate environment operations | `get_stack_env`, `set_stack_env` |
| Operation tracking | `operation_status`, `operation_logs`, `resolve_operation` |

Discover agent IDs with `list_agents`. `primary` targets the primary Dockge;
registered agents receive deterministic IDs based on their endpoints. Stack
tools require both `agent_id` and `stack_name`. `DOCKGE_ALLOWED_AGENTS` optionally
restricts accessible agents; clients cannot provide arbitrary upstream URLs.

`DOCKGE_ALLOW_WRITE`, `DOCKGE_ALLOW_DELETE`, `DOCKGE_ALLOW_ENV_READ` and
`DOCKGE_ALLOW_ENV_WRITE` are independent booleans. General reads return YAML and
opaque revision tokens without `.env` content. YAML edits preserve `.env`
internally; dedicated environment writes preserve YAML and save without deploy.
Both writes use best-effort revision checks and readback verification. Dockge
has no atomic compare-and-swap, so other UI/API writers can still race.
YAML and application logs can separately contain secrets. This is one trusted
deployment identity with the privileges of its configured Dockge account.

Shells, global settings/environment, account/agent administration, arbitrary
container control, and master-only service lifecycle/stats are deferred. Initial
UI parity follows the released operational API, with these boundaries.

## Mutation workflow

1. Read `get_stack` for the current YAML and revision before `edit_stack` or
   `deploy_stack`; use `env_revision` before `set_stack_env`.
2. Submit the mutation. It returns an `operation_id` immediately.
3. Poll `operation_status`; `succeeded` means the Dockge command completed,
   without asserting application readiness. A failure may have partial effects.
4. If the result becomes `unknown`, inspect Dockge externally. Once the command
   is no longer running and effects are understood, use `resolve_operation`
   with a reason to release its stack guard. This does not cancel or replay it.

One mutation per agent/stack is allowed; competing requests receive `busy`.
Native stop preserves containers; down removes containers/networks; delete also
removes the stack directory. Native update pulls and only starts an aggregate
RUNNING stack. Restart does not apply saved changes; start/deploy does.

Mount persistent `/data` for the Bun SQLite ledger and opaque revision secret.
Use **one bridge process per state directory**. Interrupted dispatched operations
become unknown across restart and retain guards; no mutation is replayed.
Back up the directory consistently as SQLite state, and keep it private. Never
delete the ledger to bypass unknown guards.

Requests/results are limited to 1 MiB; individual submitted documents to 512 KiB.
Logs retain the most recent 64 KiB, with truncation metadata. Configuration
operations suppress diagnostics; lifecycle diagnostics redact known credential
and environment values and are finalized when the operation settles. Logs and
resolved history expire after 24 hours (also capped at 5,000 records). Unknown
guards never expire silently. There are at most 256 unresolved operations and
128 MCP sessions; idle sessions expire after 30 minutes. Read and mutation ACK
timeouts default to 10 seconds and 120 seconds, independently configurable.
Log snapshots use Dockge's shared terminal buffer and can be stale.

## Development and distribution

```sh
bun install --frozen-lockfile
bun run check
bun test
bun run build
bun run build:arm64
```

Gitea `AI-Goes-Fast/dockge-mcp` is authoritative, mirrored to
[RealBeepMcJeep/dockge-mcp](https://github.com/RealBeepMcJeep/dockge-mcp).
Public [Actions](https://github.com/RealBeepMcJeep/dockge-mcp/actions) test native
x64/arm64 binaries and images, plus actual disposable Dockge 1.5.0 with Docker.
Successful main builds publish `ghcr.io/realbeepmcjeep/dockge-mcp:dev` and
`sha-<full-commit>`. Matching SemVer `v*` tags publish version images and binary
releases with checksums; stable releases also publish `latest`. New GHCR packages
initially need the owner to set their visibility to Public.

See the [tool contract](docs/contract.md), [accepted design](docs/design.md),
[publishing policy](docs/publishing.md), [research](docs/research/dockge.md),
[glossary](GLOSSARY.md), and [deferred work](docs/TODO.md).
The reference Dockge checkout is ignored; revisions are recorded in
[reference/README.md](reference/README.md). Licensed under [MIT](LICENSE).
