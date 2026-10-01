# Initial tool contract

Implementation contract on 2026-09-30. The initial 24 tools are implemented.
See verification.md for completed checks and remaining deployment validation.

## Baseline and targets

- TypeScript with Bun and the official JavaScript Socket.IO client.
- MCP Streamable HTTP 2025-11-25 for the tested homelab hub; SDK v1.
- Official Dockge 1.5.0 compatibility profile, with one primary and its agents.
- Explicit `agent_id` and `stack_name` on stack targets. Stable public IDs map to
  configured upstream endpoints; clients do not supply arbitrary network URLs.
- Capability/availability information per agent/profile. Never probe support by
  sending a mutation; unavailable operations return unsupported before dispatch.
- Shell/exec, Dockge administration, global settings/environment, arbitrary
  container management, and untested master additions are deferred/out of scope.

## Tools

These concrete names are a reviewable inventory; minor naming changes remain
routine implementation choices unless they alter behavior.

| Tools | Behavior / permission boundary |
| --- | --- |
| `status`, `list_agents` | Bridge/Dockge/agent connectivity and capabilities; never imply application health. Ordinary read access. |
| `list_stacks`, `stack_status`, `list_services` | Fresh bounded observations, endpoint-qualified results, and timestamps/freshness flags. Preserve unknown/mixed health limitations. Ordinary read access. |
| `get_stack` | Compose YAML, metadata, and revision tokens; no `.env` content. Ordinary read access. |
| `stack_logs` | Finite bounded recent terminal-log snapshot; truncation/freshness metadata. Ordinary log/read access. |
| `list_networks` | Available network names for the editor. Ordinary read access. |
| `compose_from_docker_run` | Use Dockge's conversion feature; return a template without deployment. Ordinary read access. |
| `scan_stacks` | Request and collect a refreshed stack list, matching Scan Stacks Folder. Refresh discovery only. |
| `create_stack` | Save a draft YAML document, never accept `.env` content in this tool. Ordinary stack-write access. |
| `edit_stack` | Replace YAML with a last-read revision precondition; preserve `.env` internally. Ordinary stack-write access. |
| `deploy_stack` | Deploy current saved config with revision validation; preserve `.env`. Ordinary stack-write access. Saving a new document remains a separate edit. |
| `start_stack`, `stop_stack`, `restart_stack`, `update_stack`, `down_stack` | Faithful Dockge operations with explicitly described effects, distinct from readiness. Ordinary lifecycle/write policy applies. |
| `delete_stack` | Faithful down/remove-orphans plus stack-directory deletion; independently enabled destructive capability. |
| `get_stack_env` | Retrieve raw stack `.env` content through a dedicated tool requiring `env_read`; not implied by ordinary reads. |
| `set_stack_env` | Replace stack `.env` through a dedicated tool requiring `env_write`; not implied by ordinary writes. Preserve YAML internally and require a last-read environment revision. |
| `operation_status`, `operation_logs` | Inspect mutation handles without exposing requested environment content or credentials. Logs are bounded; completion means CLI completion, not readiness. |
| `resolve_operation` | Explicitly acknowledge and release the stack lock for an unknown operation, without claiming the underlying command succeeded/failed or stopping it. Requires mutation/recovery authority and records a reason. |

Stock release 1.5.0 lacks master-only `startService`, `stopService`,
`restartService`, and `dockerStats` events. Those are not promised initial tools.
Native service observations and YAML editing remain supported.

## Environment preservation

Reject environment fields on general stack-tool inputs. Strip upstream
`composeENV` from ordinary stack-read outputs. Internal preservation can read the
existing document because Dockge's save API requires both documents, but no
caller-visible result/log/audit record should echo it. Do not persist raw
environment edit requests. No automatic redacted placeholder substitution.

Dedicated environment write need not imply read permission: ordinary metadata
may provide an opaque environment revision token without its content. The caller
must supply a full replacement intentionally. `env_read` and `env_write` are
disabled by default and enabled independently. Environment writes save only;
deploy/start remains a separate operation for applying changed configuration.

Detect stale revisions immediately before dispatch. Serialize bridge mutations
by agent/stack and verify preserved/changed documents afterward. Dockge UI or
another client can still race the combined upstream save; do not claim atomic
compare-and-swap or guaranteed preservation against external writers.

## Operations and errors

Every accepted mutation has an operation handle and per-agent/stack lock. A
competing mutation receives busy rather than entering a queue. The operation
outlives an individual MCP request. Canceling a client wait is not Docker command
cancellation or rollback.

Known unsupported, unavailable-before-dispatch, command-failed, stale-revision,
busy, and outcome-unknown are distinct results. Capture bounded terminal output
before dispatch; normally lifecycle ACK follows CLI exit. Never automatically
retry a mutation whose delivery/completion is uncertain. Deploy/edit failures may
leave partial changes; expose known effects rather than claiming rollback.

Persist operations and stack guards in Bun SQLite. Bounded diagnostic output is
retained for 24 hours. At process restart, interrupted/in-flight operations become
unknown and retain their guard until reconciliation establishes completion or an
operator explicitly clears it. Unknown guards are not silently released because
logs expired. Persist no raw environment edit requests. Keep unresolved operation
metadata as long as its guard exists; finite retention applies to resolved history.
Reasonable finite limits for request sizes, output, and observations will be
documented implementation defaults; none will silently request infinite follow.

## Initial access and verification

Private HTTP reachable by the hub, one MCP bearer key, and separately configured
Dockge credentials. Environment read/write permissions are independent. Advanced
per-person identity/access work is deferred. The environment boundary controls
explicit file operations; YAML/application logs can separately contain secrets.

Verify schema/result consistency, Bun HTTP/SSE behavior, ACK/reconnect/routing,
target isolation, conflicting/uncertain mutations, and environment permission
separation. Initial live mutation tests use disposable stacks. Existing production
stacks are not integration-test fixtures.

## Distribution

MIT license. Build a Docker image and compiled Bun executables for Linux x64 and
arm64. Gitea is authoritative with a public mirror at
`realbeepmcjeep/dockge-mcp`. GitHub Actions publishes to
`ghcr.io/realbeepmcjeep/dockge-mcp`. The source mirror is configured; Actions
uses its generated GITHUB_TOKEN, without sharing the mirror PAT with the bridge.
See publishing.md for the release policy.
