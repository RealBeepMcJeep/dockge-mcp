# Separate stack environment access from general stack operations

Retrieval and modification of a stack's `.env` content will use dedicated tools
with independent environment-read and environment-write permissions. General
stack reading/editing/deployment must not expose or accept that content and must
preserve existing environment values. Dockge's combined save API requires the
adapter to read and preserve the untouched document internally; this does not
grant the caller permission to retrieve it. The separation allows useful stack
management without automatically giving access to environment secrets.
