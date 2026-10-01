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

## Build follow-ups

- Initial source mirroring, native x64/arm64 binaries/images, actual primary
  Dockge integration and public GHCR publication passed; see verification.md.
- Update pinned Actions that emitted Node 20 deprecation notices to Node 24
  releases; revalidate workflow behavior.
- Exercise tagged releases and binary release assets/checksums.
- Add actual multi-agent CI topology; agent routing/failures are covered by
  protocol fixtures, while the actual Dockge job uses a single primary.

## Verification before a supported deployment

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
