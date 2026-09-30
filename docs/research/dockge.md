# Dockge source and UI review

Reviewed 2026-09-30 at commit
`f809ae192b571944ad773e9866d3e67064ae8043`. Links below pin source findings to that
revision. These are static findings, not live-instance verification.

## Release comparison: critical distinction

Follow-up review of the official
[1.5.0 release source](https://github.com/louislam/dockge/blob/1.5.0/backend/stack.ts)
found that it **does persist `.env`**. The missing write discussed below applies
to the pinned master snapshot, not to released 1.5.0. Release service status
maps a service to a status string, while master returns arrays of container
names/statuses. Released 1.5.0 also lacks the master's service start/stop/restart
methods/handlers or `dockerStats`. Both report package version 1.5.0, so version-string checks
alone cannot establish supported capabilities. Use tested, explicitly configured
compatibility profiles and clearly report unsupported features. Shared PTY shell
limitations remain in the release.

The official [release](https://github.com/louislam/dockge/releases/tag/1.5.0) is
dated 2025-03-30 and its tag resolves to commit
`bac498f97ffc33f7ffb2380bd68493de0719f4dd`. No live Dockge URL/version was
discoverable from the available workspace/configuration. Live-instance support
remains unverified. Operational parity must refer to a specific UI release,
rather than including every capability added on unreleased master.

## Documentation and feasibility

Dockge's [README](https://github.com/louislam/dockge/blob/f809ae192b571944ad773e9866d3e67064ae8043/README.md)
documents stack lifecycle/editing, image updates, terminals, multi-host agents,
and conversion from Docker run commands. Its FAQ scopes management to Compose
applications. Standalone containers and broader Docker administration exceed that
scope. Installation mounts Docker's socket and requires the stacks directory to
have matching host/container paths. Private registry access uses Docker's auth
configuration.

The [wiki](https://github.com/louislam/dockge/wiki) currently contains only its
Home/history page. There is no documented stable REST automation API in the
reviewed docs. [CONTRIBUTING.md](https://github.com/louislam/dockge/blob/f809ae192b571944ad773e9866d3e67064ae8043/CONTRIBUTING.md)
describes the backend as primarily Socket.IO plus Express. A Socket.IO adapter is
feasible, but it would depend on internal UI protocol behavior.

## Protocol shape

Authenticate with `login({username, password, token?}, ack)` or
`loginByToken(jwt, ack)`. JWT login checks the user's active state and password
hash. Register listeners before authentication: initial lists may arrive during
login. Credentials are connection configuration, not model-visible tool inputs.
See [main-socket-handler.ts](https://github.com/louislam/dockge/blob/f809ae192b571944ad773e9866d3e67064ae8043/backend/socket-handlers/main-socket-handler.ts).

Operational requests use:

```text
socket.emit("agent", endpoint, eventName, ...arguments, acknowledgement)
```

An empty endpoint addresses the connected instance; a remote endpoint is routed
through its agent manager. The all-endpoints sentinel broadcasts and should not
be accepted accidentally for a mutation. Responses and pushes from agents are
also multiplexed through an `agent` envelope. See
[agent-proxy-socket-handler.ts](https://github.com/louislam/dockge/blob/f809ae192b571944ad773e9866d3e67064ae8043/backend/socket-handlers/agent-proxy-socket-handler.ts)
and [frontend socket mixin](https://github.com/louislam/dockge/blob/f809ae192b571944ad773e9866d3e67064ae8043/frontend/src/mixins/socket.ts).

## Candidate tool mapping

Names below are proposals for the interview, not a finalized tool contract.
All events in this table are agent-wrapped. See
[docker-socket-handler.ts](https://github.com/louislam/dockge/blob/f809ae192b571944ad773e9866d3e67064ae8043/backend/agent-socket-handlers/docker-socket-handler.ts).

| Candidate capability | Dockge event / source behavior |
| --- | --- |
| `list_stacks`, scan stacks | `requestStackList(ack)` triggers a separately pushed `stackList`; ACK does not contain the list. |
| `get_stack` / editing input | `getStack(name, ack)` returns Compose YAML/environment plus metadata; also starts/join logs. |
| `create_stack` | `saveStack(name, yaml, env, true, ack)` saves a draft. |
| `edit_stack` | `saveStack(name, yaml, env, false, ack)` saves without deploying. |
| `deploy_stack` | `deployStack(name, yaml, env, isAdd, ack)` saves first, then runs Compose up. |
| `start_stack` | `startStack(name, ack)` runs `compose up -d --remove-orphans`. |
| `stop_stack` | `stopStack(name, ack)` runs `compose stop`, retaining containers. |
| `restart_stack` | `restartStack(name, ack)` runs `compose restart`; not deployment of changed config/images. |
| `down_stack` | `downStack(name, ack)` runs `compose down`, retaining stack files. |
| `delete_stack` | `deleteStack(name, ack)` runs down with remove-orphans, then recursively removes the stack directory. No volumes flag is passed. |
| `update_stack` | `updateStack(name, ack)` pulls images, refreshes status, runs up with remove-orphans only when status is RUNNING. |
| `stack_status` / service list | `serviceStatusList(name, ack)` provides service-to-container-name/health-state groups; stack overview status comes from `stackList`. |
| `service_start/stop/restart` | `startService/stopService/restartService(stack, service, ack)` operate on Compose services. |
| `container_stats` | `dockerStats(ack)` returns host-wide stats; filter to the authorized target. |
| `list_networks` | `getDockerNetworkList(ack)` supports the editor's network selection. |
| `stack_logs` | Join combined terminal via `getStack`; `terminalJoin(name, ack)` gives the existing buffer and `terminalWrite` gives future output. |
| Service shell | `interactiveTerminal(stack, service, shell, ack)`, then `terminalInput` and terminal output events. |

Do not describe service lifecycle methods as individual container-ID operations:
the [Container component](https://github.com/louislam/dockge/blob/f809ae192b571944ad773e9866d3e67064ae8043/frontend/src/components/Container.vue)
represents Compose services. General inspect/exec/logs-by-container-ID APIs are
not present in these handlers.

Other UI features include agent configuration, settings/password/2FA management,
Docker-run conversion, and the optional main console. The interview must decide
which of these count toward parity. Server info is pushed on `info`; there is no
single upstream `status` event matching the proposed MCP name.

## Status, completion, and terminal behavior

[Status values](https://github.com/louislam/dockge/blob/f809ae192b571944ad773e9866d3e67064ae8043/common/util-common.ts)
are UNKNOWN=0, CREATED_FILE/draft=1, CREATED_STACK=2, RUNNING=3, EXITED=4.
Stack overview status is coarse and is not a complete per-container health model.
Service status uses health when available, otherwise state; it does not preserve
both separately, and its Compose ps query does not request stopped containers.

Lifecycle ACKs normally arrive after the Docker CLI command exits. They establish
command completion, not application readiness. `requestStackList` instead ACKs
the refresh request before the independently delivered snapshot. Register and
correlate listeners accordingly.

[Stack logs](https://github.com/louislam/dockge/blob/f809ae192b571944ad773e9866d3e67064ae8043/backend/stack.ts)
are a shared PTY running `compose logs -f --tail 100`. Output includes terminal
formatting, and historical log filtering is not an exposed parameterized API.
Terminal buffers and terminal names are shared by endpoint/stack/service. MCP
must bound output and distinguish a log snapshot from a complete log archive.

Interactive shells use `compose exec service shell`, default `sh`. Bash is not
guaranteed. The terminal-name index is not forwarded as Compose `--index`, so it
does not provide reliable replica targeting. Successful `terminalInput` has no
success ACK in this source; shell output does not itself provide a per-command
exit code. A finite exec tool would require careful command framing or a broader
backend. A shell session is not equivalent to Docker's structured exec API.

## Source pitfalls to resolve before promising parity

1. `saveStack` accepts environment content, but `Stack.save()` writes only the
   Compose YAML in this snapshot. `.env` is read by the getter but not persisted
   by save. Do not claim `.env` editing works without a tested fix/workaround.
2. `getStack()` creates a new object whose initial status is UNKNOWN; do not rely
   on that response alone for current stack status.
3. Stack-level commands use `getComposeOptions`, including `global.env` and local
   `.env` handling. Service lifecycle methods use raw Compose argv and omit that
   helper. Parity inherits this difference unless deliberately corrected.
4. The 2FA login branch references `notp`/`twoFAVerifyOptions` without definitions
   in the reviewed file. Test the actual target release before promising TOTP.
5. Deploy saves before starting containers. A failure can leave changed files;
   create/edit/deploy are not atomic transactions.
6. Proxy routing errors can be logged without a callback. Use bounded timeouts
   and report uncertain completion rather than retrying mutations blindly.
7. No compare-and-swap edit, per-operation identifier, or command cancellation
   API is exposed by the reviewed operational handlers. Adapter-local locks
   cannot prevent edits from Dockge's UI or another client.

These findings justify a supported-version declaration, source-pinned fixtures,
and live verification on an isolated test instance before release.

Additional caveats: stats/service-status failures can be converted upstream to
empty maps, so emptiness does not establish a healthy empty host. Any exited
service can make the aggregate stack status EXITED even with running services.
Operation terminals disappear after process exit; capture output before dispatch
rather than fetching it only after failure. Concurrent commands on a stack share
a terminal and may fail without a usable ACK. Shell sessions are globally cached
by service and can be shared with other clients. There is no exposed isolated
shell close/per-command completion API. These are material limitations for
automation, not simply UI presentation differences.
