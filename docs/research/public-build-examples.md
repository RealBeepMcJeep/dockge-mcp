# Public image-build examples

The owner invited review of public `RealBeepMcJeep` repositories. These findings
come from read-only GitHub API/source inspection on 2026-09-30; no repository,
workflow, or package was changed.

## Obsidian MCP Lite

Reviewed revision: `91cbe9243e10ebbd547d2ca47935b5f0b07e283f`.
[publish.yml](https://github.com/RealBeepMcJeep/obsidian-mcp-lite/blob/91cbe9243e10ebbd547d2ca47935b5f0b07e283f/.github/workflows/publish.yml)
runs on main pushes/manual dispatch, waits for reusable CI, scopes package-write
permission to publishing, builds with Buildx/metadata and GitHub Actions caching,
and checks the pushed image plus anonymous package visibility. Tags include a
short commit SHA and latest; current platform is amd64 only.

[CI](https://github.com/RealBeepMcJeep/obsidian-mcp-lite/blob/91cbe9243e10ebbd547d2ca47935b5f0b07e283f/.github/workflows/ci.yml)
gates tests, lint, image build, and MCP smoke checks. The
[Dockerfile](https://github.com/RealBeepMcJeep/obsidian-mcp-lite/blob/91cbe9243e10ebbd547d2ca47935b5f0b07e283f/Dockerfile)
uses frozen dependencies and a non-root runtime user. This is a useful structural
template for dockge-mcp's Bun equivalents.

## Yoto MCP

Reviewed revision: `fb6cde670530422dc1fcbcca7f2daf3bc271028e`.
[publish.yml](https://github.com/RealBeepMcJeep/yoto-mcp/blob/fb6cde670530422dc1fcbcca7f2daf3bc271028e/.github/workflows/publish.yml)
also gates publication on CI and tests both commit and latest tags. It passes
build commit/time/tag metadata and verifies anonymous manifest access. It
currently publishes amd64 only; publication runs are not canceled mid-flight.

The [visibility script](https://github.com/RealBeepMcJeep/yoto-mcp/blob/fb6cde670530422dc1fcbcca7f2daf3bc271028e/scripts/verify_public_image.py)
checks an unauthenticated registry manifest response. This establishes manifest
visibility rather than a complete download/run check for every architecture.

## YNAB MCP Lite

Reviewed revision: `a897c020afcf330385ed39cd92c9bdda5ec1ed62`.
[publish.yml](https://github.com/RealBeepMcJeep/ynab-mcp-lite/blob/a897c020afcf330385ed39cd92c9bdda5ec1ed62/.github/workflows/publish.yml)
has a simpler Buildx/cache pipeline and HTTP/MCP smoke check. Publication runs
independently of CI and can cancel an earlier publication. The
[Dockerfile](https://github.com/RealBeepMcJeep/ynab-mcp-lite/blob/a897c020afcf330385ed39cd92c9bdda5ec1ed62/Dockerfile)
installs unfrozen dependencies despite frozen CI installs. Use the newer
Obsidian/Yoto conventions for this project.

## Adaptation for Dockge MCP

Use CI-gated publishing, immutable commit/digest identity, build metadata, cache,
post-build MCP smoke, and anonymous GHCR checks. Replace Python/uv with pinned
Bun and its frozen lockfile. Add native x64/arm64 artifact validation and compiled
Bun release binaries/checksums, which these examples do not currently provide.

Keep our documented dev-on-main and stable-latest-on-release tagging policy,
rather than copying the examples' latest-on-main convention. Smoke-test the
immutable built artifact before promoting mutable channel tags. Pin action
commits instead of copying floating action versions. Gitea-to-GitHub mirroring
remains a separate deployment setup step; it is not supplied by these examples.
