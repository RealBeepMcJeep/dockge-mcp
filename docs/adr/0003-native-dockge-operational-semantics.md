# Preserve native Dockge operational semantics

The adapter will follow the supported Dockge release's native operations and
target types, addressing one primary instance and its registered agents with
explicit agent/stack identity. Save, deploy, stop, down, delete, and update retain
their distinct Dockge behaviors, including updating a stopped stack without
starting it. This preserves a predictable relationship between UI and MCP actions
at the cost of foregoing broader container management and more convenient custom
lifecycle behavior. Shell access is deferred from the first release.
