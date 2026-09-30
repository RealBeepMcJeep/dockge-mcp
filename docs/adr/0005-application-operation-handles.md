# Track mutations with application operation handles

Mutations return an operation handle inspectable through status/log tools, so a
long-running pull or deployment can outlive the MCP call. Only one mutation per
agent/stack may proceed at a time; competing requests receive a busy result.
Unknown completion after a lost response must be reconciled rather than replayed.
This avoids dependence on optional MCP task support at the cost of application
operation tracking. Persistence, retention, and restart recovery were subsequently
accepted in ADR 0006.
