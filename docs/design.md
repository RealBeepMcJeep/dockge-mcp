# Design interview

Status: round 2 answers recorded (2026-09-30); Q8 and Q12 remain open. Unanswered
recommendations remain proposals. The invoked `grill-with-docs` skill combines an interview
with glossary and ADR updates. Implementation begins after shared understanding
is confirmed; repository creation and research were separately authorized.

## Authorized and completed

- Create `AI-Goes-Fast/dockge-mcp` on the configured Gitea instance.
- Work in `/workspace/homelab/dockge-mcp`.
- Clone Dockge for reference and review its source/docs.
- Review current official MCP server guidance.
- Conduct the design interview and record resolved terminology and decisions.

The repository starts private, matching the organization visibility. Public
distribution and licensing remain open.

## Round 1: accepted

| Question | Recommendation | Owner's answer |
| --- | --- | --- |
| Q1: Integration boundary: Dockge Socket.IO, direct Docker/Compose, or both? | Authenticated remote Socket.IO adapter to Dockge; declare compatibility. | Accepted |
| Q2: UI parity: operations, complete administration, or original tools first? | Operational parity: stack/service actions, editing, deployment, status/logs, scoped terminals. | Accepted |
| Q3: MCP deployment: HTTP via homelab hub, local stdio, or both? | Container with Streamable HTTP via hub. | Accepted |
| Q4: Audience: reusable project, homelab only, or public first release? | Reusable project with homelab as first deployment. | Accepted |

## Round 2: current frontier

| Question | Recommendation | Owner's answer |
| --- | --- | --- |
| Q5: One primary Dockge plus its registered agents, or multiple independently configured instances? | One primary plus its registered agents; explicit agent/stack identity on mutations. | Accepted |
| Q6: Service-level tools or individual container-instance management? | `service_*` lifecycle tools matching Dockge; container names/stats are observational. | Follow native Dockge UI/UX for the supported release. No broader container manager. |
| Q7: Shell fidelity and scope? | Opt-in bounded service shell sessions reflecting the shared Dockge terminal; no promise of isolated one-shot exec. | Defer shells; potentially valuable future capability. |
| Q8: Behavior when a configured Dockge profile cannot perform an operation reliably? | Return an explicit unsupported result; no hidden filesystem, Docker, or host-console fallback. | Open: owner requests concrete examples and proposed responses. |
| Q9: Faithful Dockge lifecycle semantics or custom behavior? | Separate save/deploy/stop/down/delete; update stopped stacks only pulls; return CLI completion separately from readiness. | Accepted: faithful. |
| Q10: Trusted shared service identity or per-person/multi-tenant identities? | One trusted deployment identity with configurable capabilities/targets; document the trust boundary. | Accepted: keep initial access model simple; deferred work/testing goes to TODO. |
| Q11: Editor contract? | Complete document replacement with a required last-read content hash; omitted environment is preserved, with best-effort conflict detection and no claim of atomic concurrency protection. | Accepted |
| Q12: Runtime/distribution/license? | TypeScript on supported Node LTS, container-first packaging, npm entrypoint, MIT license. | Open: investigate Rust; owner prefers a single binary with few dependencies. License remains unconfirmed. |
| Q13: Supported Dockge/MCP baseline? | Released Dockge 1.5.0 with an explicit profile; MCP 2025-11-25 for the current hub. Add other profiles/protocols after testing. | Accepted; owner reports live Dockge displays 1.5.0. SDK implementation depends on Q12. |

Release comparison found that tag `1.5.0` persists `.env`, while reviewed master
does not. Released 1.5.0 lacks the master's service lifecycle handlers and uses
a different service-status response shape, despite the same package version.
Q8 concerns unsupported behavior generally. Q11 requires refusing
stale edits where detectable, but Dockge has no atomic compare-and-swap API; an
upstream UI edit after preflight remains possible.

## Round 3: current frontier

| Question | Recommendation | Owner's answer |
| --- | --- | --- |
| Q8 follow-up: unsupported feature versus unknown result? | Known unavailable features fail before dispatch; lost mutation responses remain unknown and are reconciled, never blindly retried. See unsupported-scenarios.md. | Pending |
| Q12 follow-up: Rust versus TypeScript? | Rust binary plus Docker wrapper, subject to an initial Socket.IO/HTTP/static-packaging validation milestone. MIT remains proposed. See research/runtime.md. | Pending |
| Q14: Slow operations: blocking calls or operation handles? | Mutations return an operation handle; operation_status/operation_logs report command completion independently of request lifetime. | Pending |
| Q15: Overlapping operations on a stack? | One mutation at a time per agent/stack; reject busy requests instead of silently queuing stale actions. | Pending |
| Q16: Initial authentication/network boundary? | Private hub-reachable HTTP listener, one MCP bearer key, separately configured Dockge credentials. No per-person identity machinery initially. | Pending |
| Q17: Read/output contract? | Finite bounded log snapshots; YAML available for editing; environment values redacted by default with explicit authorized retrieval. Omitted environment edits preserve existing values. | Pending |

Requests for logs remain observational; interactive shell/exec is deferred.
Operation retention/restart recovery will be decided after Q14. Authentication
details and live-profile verification still require the configured Dockge URL;
credentials should be supplied through configuration, not pasted into the chat.

Read-only research is checking actual hub/client compatibility and Dockge release
behavior. The configured `/mcp/paseo-pi` route negotiated MCP 2025-11-25 even when
2026-07-28 was requested. No primary Dockge URL was discoverable in available
workspace/configuration, so live Dockge compatibility still requires its URL.
Questions that depend on remaining facts stay deferred. Later rounds
will settle downstream authentication, HTTP exposure, operation recovery,
output limits/secret handling, shell sharing/session behavior, and acceptance
criteria once their prerequisites are answered.

## Design tree

```mermaid
flowchart TD
  Root[Dockge MCP] --> Integration[Q1: Integration boundary]
  Root --> Scope[Q2: Parity scope]
  Root --> Deployment[Q3: MCP deployment]
  Root --> Audience[Q4: Audience]
  Integration --> Auth[Dockge authentication and supported versions]
  Integration --> Hosts[Agent identity and multi-host routing]
  Integration --> Editing[Compose and environment persistence guarantees]
  Scope --> Targets[Service versus individual container targets]
  Scope --> Exec[Finite exec versus interactive terminals]
  Scope --> Lifecycle[Stop / down / delete / update semantics]
  Scope --> Admin[Administration and host-console boundary]
  Deployment --> Client[Actual hub/client protocol compatibility]
  Deployment --> Access[Client authentication and access policy]
  Audience --> Release[License, runtime, packaging, compatibility policy]
  Editing --> Concurrency[Conflicts, revisions, and partial failures]
  Lifecycle --> Operations[Completion, operation handles, and cancellation]
  Exec --> Operations
  Operations --> Recovery[Reconnect, unknown outcomes, and retention]
  Targets --> Output[Status freshness and bounded logs/output]
  Access --> Isolation[Caller and target isolation]
```

Later rounds will resolve each branch once its prerequisites are answered. Concrete
scenarios to examine include two agents with the same stack name, edits racing the
UI, a lost connection during an update, a stopped stack being updated, services
with multiple replicas, images without bash, and a failed deploy after files were
already saved. Upstream source findings may make some proposed tools unsupported
without an upstream fix or a deliberately broader backend.

Accepted architectural trade-offs are recorded in `docs/adr/`. Record additional
ADRs only for significant resolved trade-offs; do not turn every implementation
choice into an ADR.
