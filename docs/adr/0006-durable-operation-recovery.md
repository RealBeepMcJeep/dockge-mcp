# Persist operation recovery state in Bun SQLite

Persist operation records and per-stack guards in Bun's built-in SQLite rather
than losing them with MCP request/process lifetime. Retain bounded diagnostic
output for 24 hours; interrupted operations become unknown and keep their guards
until reconciled or explicitly cleared, without automatic replay. This adds
durable state to deployment but avoids presenting a restarted bridge as idle
while a previously dispatched Dockge mutation may still be running.
