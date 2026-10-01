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

- Configure GitHub access for `realbeepmcjeep/dockge-mcp`, a one-way Gitea push
  mirror, and automatic builds/releases. Make GHCR package public and verify
  anonymous pulls after first publication. See publishing.md.
- Verify compiled x64/arm64 executables and multi-platform image through public
  CI, with no production Dockge credentials.
- Run actual Dockge 1.5.0/Docker integration on disposable GitHub Ubuntu runners;
  local workspace has no Docker engine/socket or Docker/Podman executable.
- Verify the TypeScript MCP SDK's legacy Streamable HTTP behavior and official
  Socket.IO client's ACK/event/reconnect handling under the selected Bun runtime.
- Verify environment read/write permission isolation and preservation of `.env`
  during general YAML saves/deployment; include concurrent changes/partial writes.
- For later homelab deployment, obtain the primary Dockge URL through configuration; verify its actual release
  or image/source fingerprint. Its reported 1.5.0 version is insufficient alone.
- Verify Dockge authentication and registered-agent routing on a read-only path
  when homelab access becomes available. It is unavailable now and is not a
  prerequisite for local source-based implementation or disposable CI tests.
- Verify the selected runtime's MCP transport against the actual homelab hub.
- Validate live mutations on disposable test stacks, including environment-file
  persistence, conflict handling, partial deploy failures, and lost connections.

These deployment checks remain required acceptance work; recording them here
does not assert that they passed or authorize changes to live production stacks.
