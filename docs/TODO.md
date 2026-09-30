# Deferred work

## Future capabilities

- Service/container shell access: potentially valuable, explicitly deferred by
  the owner. Resolve upstream shared-terminal behavior, isolation, completion,
  output limits, and lifecycle before exposing it.
- Per-person Dockge identities and more advanced access policies; start with one
  trusted deployment identity. Deferred access-model work/tests belong here.
- Other Dockge compatibility profiles, including unreleased master features;
  first baseline is official release 1.5.0.
- Newer MCP protocol support after verifying hub/client compatibility.
- Local stdio packaging if requested after the HTTP-first release.

## Verification before a supported deployment

- Verify the TypeScript MCP SDK's legacy Streamable HTTP behavior and official
  Socket.IO client's ACK/event/reconnect handling under the selected Bun runtime.
- Verify environment read/write permission isolation and preservation of `.env`
  during general YAML saves/deployment; include concurrent changes/partial writes.
- Obtain the primary Dockge URL through configuration; verify its actual release
  or image/source fingerprint. Its reported 1.5.0 version is insufficient alone.
- Verify Dockge authentication and registered-agent routing on a read-only path.
- Verify the selected runtime's MCP transport against the actual homelab hub.
- Validate live mutations on disposable test stacks, including environment-file
  persistence, conflict handling, partial deploy failures, and lost connections.

These deployment checks remain required acceptance work; recording them here
does not assert that they passed or authorize changes to live production stacks.
